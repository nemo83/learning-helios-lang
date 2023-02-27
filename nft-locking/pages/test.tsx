
import LockAda from '../components/LockAda';
import ClaimFunds from '../components/ClaimFunds';
import CancelVesting from '../components/CancelVesting';
import Head from 'next/head'
import type { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import { useState, useEffect } from "react";
import WalletInfo from '../components/WalletInfo';
import {
  Assets,
  Address,
  ByteArrayData,
  Cip30Handle,
  Cip30Wallet,
  ConstrData,
  Datum,
  hexToBytes,
  IntData,
  ListData,
  MintingPolicyHash,
  NetworkParams,
  NetworkEmulator,
  Program,
  Value,
  TxOutput,
  Tx,
  TxId,
  UTxO,
  WalletHelper,
  ByteArray,
  PubKeyHash
} from "@hyperionbt/helios";

import path from 'path';
import { promises as fs } from 'fs';

declare global {
  interface Window {
    cardano: any;
  }
}

const Home: NextPage = (props: any) => {

  const nftName = 'My Cool NFT'

  const lockNftScript = `
  spending lock_nft

  struct Datum {
      admin: PubKeyHash
      participants: [] PubKeyHash

      func is_admin(self, tx: Tx) -> Bool { tx.is_signed_by(self.admin) }
  }

  enum Redeemer {
    Admin
  }
  
  func main(datum: Datum, redeemer: Redeemer, context: ScriptContext) -> Bool {
      tx: Tx = context.tx;
      redeemer.switch {
        Admin => {
            datum.is_admin(tx).trace("IS_ADMIN: ")
        }
    }
  }` as string

  const lockNftDatumScript = `
  const ADMIN_BYTES   = # // must be 28 bytes long
  
  const DATUM = Datum{
    admin: PubKeyHash::new(ADMIN_BYTES)
  }` as string

  const generatePublicSaleDatum = (admin: any) => {
    // public sale, don't set the buyer bytes
    return Program.new(lockNftScript + lockNftDatumScript)
      .changeParam("ADMIN_BYTES", JSON.stringify(admin.pubKeyHash.bytes))
      .evalParam("DATUM").data
  }

  useEffect(() => {
    console.log('Hello world!');
  }, []);


  const doSomething = async () => {

    const network = new NetworkEmulator();

    const networkParams = new NetworkParams(
      await fetch('https://d1t0d7c2nekuk0.cloudfront.net/preview.json').then(
        (response) => response.json()
      )
    );

    const assets = new Assets();

    assets.addComponent(
      MintingPolicyHash.fromHex(
        '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c'
      ),
      Array.from(new TextEncoder().encode('PodgyPenguin1047')),
      BigInt(1)
    );

    const alice = network.createWallet(BigInt(100_000_000));
    // const alice = network.createWallet(BigInt(100_000_000), assets);
    const bruce = network.createWallet(BigInt(100_000_000));

    network.tick(BigInt(10));

    const aliceUtxos = await network.getUtxos(alice.address)

    aliceUtxos.forEach(utxo => logUtxo(utxo))

    // Minting Script
    const mintScript = `
    minting nft

    const TX_ID: ByteArray = #` + aliceUtxos[0].txId.hex + `
    const txId: TxId = TxId::new(TX_ID)
    const outputId: TxOutputId = TxOutputId::new(txId, ` + aliceUtxos[0].utxoIdx + `)
    
    func main(ctx: ScriptContext) -> Bool {
        tx: Tx = ctx.tx;
        mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();
    
        assetclass: AssetClass = AssetClass::new(
            mph, 
            "My Cool NFT".encode_utf8()
        );
        value_minted: Value = tx.minted;
    
        // Validator logic starts
        (value_minted == Value::new(assetclass, 1)).trace("NFT1: ") &&
        tx.inputs.any((input: TxInput) -> Bool {
                                        (input.output_id == outputId).trace("NFT2: ")
                                        }
        )
    }`

    // Compile the helios minting script
    const mintProgram = Program.new(mintScript).compile(false);


    // Construct the NFT that we will want to send as an output
    const nftTokenName = ByteArrayData.fromString(nftName).toHex();
    const tokens: [number[], bigint][] = [[hexToBytes(nftTokenName), BigInt(1)]];

    // Create an empty Redeemer because we must always send a Redeemer with
    // a plutus script transaction even if we don't actually use it.
    const mintRedeemer = new ConstrData(0, []);

    const lockedVal = new Value(BigInt(0), new Assets([[mintProgram.mintingPolicyHash, tokens]]));

    // Minting TX
    const tx = new Tx();

    const utxos = await network.getUtxos(alice.address)
    await tx
      .addInputs(await network.getUtxos(alice.address))
      .attachScript(mintProgram)
      // The minting
      .mintTokens(
        mintProgram.mintingPolicyHash,
        tokens,
        mintRedeemer
      )
      .addOutput(new TxOutput(alice.address, lockedVal))
      .addCollateral(aliceUtxos[1])
      .finalize(networkParams, alice.address);

    console.log("tx after final", tx.dump());

    console.log("Verifying signature...");
    const signatures = await alice.signTx(tx);
    tx.addSignatures(signatures);

    console.log("Submitting transaction...");
    const txHash = await alice.submitTx(tx);
    console.log('txHash: ' + txHash.hex)

    network.tick(BigInt(10));

    const finalAliceUtxos = await network.getUtxos(alice.address)
    finalAliceUtxos.forEach(utxo => logUtxo(utxo))

  }

  const logUtxo = (utxo: UTxO) => {
    console.log('asd')
    console.log('utxo: ' + utxo.address.toBech32())
    console.log('utxo: ' + utxo.txId.hex)
    console.log('utxo: ' + utxo.utxoIdx)
    console.log('utxo: ' + utxo.value.lovelace)
    utxo.value.assets.mintingPolicies.forEach(mph => {
      console.log('mph: ' + mph.hex)
    })
  }

  return (
    <div>
      <p>Hello world!</p>
      <button type='button' onClick={() => doSomething()}>Do Something</button>
    </div>
  )
}

export default Home