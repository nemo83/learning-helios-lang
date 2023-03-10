
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