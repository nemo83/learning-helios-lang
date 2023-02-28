
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
      ticketPrice: Value
      participants: []PubKeyHash

      func is_admin(self, tx: Tx) -> Bool { tx.is_signed_by(self.admin) }
  }

  enum Redeemer {
    Admin
    JoinRaffle {
      pkh: PubKeyHash
    }
  }
  
  func main(datum: Datum, redeemer: Redeemer, context: ScriptContext) -> Bool {
      tx: Tx = context.tx;
      redeemer.switch {
        Admin => {
            datum.is_admin(tx).trace("IS_ADMIN: ")
        },
        joinRaffle: JoinRaffle => {
          // Test 3 things
          // 1. ticketPrice is paid into the contract (that all that was in the script, + the ticket price , is sent to the datum)
          // 2. uxto where previous datum leaves to be spent
          // 3. new datum is like current + participants contains the pkh of current signer.
          if (!tx.is_signed_by(joinRaffle.pkh)) {
            false
          } else {
            
            valueLocked: Value = tx.value_locked_by_datum(context.get_current_validator_hash(), datum, true);

            expectedTargetValue: Value = valueLocked + datum.ticketPrice;
  
            new_datum: Datum = Datum { datum.admin, datum.ticketPrice, datum.participants.prepend(joinRaffle.pkh) };
  
            actualTargetValue: Value = tx.value_locked_by_datum(context.get_current_validator_hash(), new_datum, true);
  
            actualTargetValue >= expectedTargetValue

          }
        }
    }
  }` as string

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
      Array.from(new TextEncoder().encode(nftName)),
      BigInt(1)
    );

    const alice = network.createWallet(BigInt(100_000_000));
    // const alice = network.createWallet(BigInt(100_000_000), assets);
    const bruce = network.createWallet(BigInt(100_000_000));

    network.tick(BigInt(10));

    const program = Program.new(lockNftScript)
    const datum = new (program.types.Datum)(
      alice.address.pubKeyHash,
      new Value(BigInt(5000000)),
      [alice.address.pubKeyHash, bruce.address.pubKeyHash]
    )

    // const datum = generatePublicSaleDatum(alice.address, [alice.address, bruce.address])

    console.log('datum: ' + datum.toSchemaJson())

    const aliceUtxos = await network.getUtxos(alice.address)

    aliceUtxos.forEach(utxo => logUtxo(utxo))

    // Compile the helios minting script
    const mintProgram = Program.new(lockNftScript).compile(false);


    // // Minting TX
    // const tx = new Tx();

    // const utxos = await network.getUtxos(alice.address)
    // await tx
    //   .addInputs(await network.getUtxos(alice.address))
    //   .attachScript(mintProgram)
    //   // .addOutput(new TxOutput(alice.address, lockedVal))
    //   .addCollateral(aliceUtxos[1])
    //   .finalize(networkParams, alice.address);

    // console.log("tx after final", tx.dump());

    // console.log("Verifying signature...");
    // const signatures = await alice.signTx(tx);
    // tx.addSignatures(signatures);

    // console.log("Submitting transaction...");
    // const txHash = await alice.submitTx(tx);
    // console.log('txHash: ' + txHash.hex)

    // network.tick(BigInt(10));

    // console.log('------')

    // const finalAliceUtxos = await network.getUtxos(alice.address)
    // finalAliceUtxos.forEach(utxo => logUtxo(utxo))


  }

  const logUtxo = (utxo: UTxO) => {
    console.log('asd')
    console.log('utxo: ' + utxo.address.toBech32())
    console.log('utxo: ' + utxo.txId.bytes)
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