
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
  PubKeyHash,
  WalletEmulator,
  UplcProgram,
  HeliosData,
  UplcList,
  UplcData
} from "@hyperionbt/helios";

import path, { toNamespacedPath } from 'path';
import { promises as fs } from 'fs';

declare global {
  interface Window {
    cardano: any;
  }
}

const Home: NextPage = (props: any) => {

  const nftName = 'My Cool NFT'

  const nftMph = MintingPolicyHash.fromHex(
    '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c'
  )

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
      print("hello world");
      redeemer.switch {
        Admin => {
            datum.is_admin(tx).trace("TRACE_IS_ADMIN: ")
        },
        joinRaffle: JoinRaffle => {
          
          // Test 3 things
          // 1. ticketPrice is paid into the contract (that all that was in the script, + the ticket price , is sent to the datum)
          // 2. uxto where previous datum leaves to be spent
          // 3. new datum is like current + participants contains the pkh of current signer.
          if (!tx.is_signed_by(joinRaffle.pkh)) {
            false.trace("TRACE_SIGNED_BY_PARTICIPANT: ")
          } else {
            
            valueLocked: Value = tx.value_locked_by_datum(context.get_current_validator_hash(), datum, true);

            expectedTargetValue: Value = valueLocked + datum.ticketPrice;
  
            new_datum: Datum = Datum { datum.admin, datum.ticketPrice, datum.participants.prepend(joinRaffle.pkh) };
  
            actualTargetValue: Value = tx.value_locked_by_datum(context.get_current_validator_hash(), new_datum, true);
  
            (actualTargetValue >= expectedTargetValue).trace("TRACE_ALL_GOOD? ")

          }
        }
    }
  }` as string

  const doSomething = async () => {

    const useNetworkEmulator = false;

    const network = new NetworkEmulator();

    const networkParams = new NetworkParams(
      await fetch('https://d1t0d7c2nekuk0.cloudfront.net/preview.json').then(
        (response) => response.json()
      )
    );

    const assets = new Assets();

    assets.addComponent(
      nftMph,
      Array.from(new TextEncoder().encode(nftName)),
      BigInt(1)
    );

    // const alice = network.createWallet(BigInt(100_000_000));
    const alice = network.createWallet(BigInt(100_000_000), assets);
    network.tick(BigInt(10));

    const bruce = network.createWallet(BigInt(100_000_000));
    network.tick(BigInt(10));

    console.log('Alice PKH: ' + alice.pubKeyHash.hex)
    console.log('Bruce PKH: ' + bruce.pubKeyHash.hex)

    network.tick(BigInt(10));

    inspectUTxOsAtAddress(alice.address, "Alice Address at the beginning", network)
    inspectUTxOsAtAddress(bruce.address, "Bruce Address at the beginning", network)

    // Compile the helios minting script
    const raffleProgram = Program.new(lockNftScript);
    const raffleUplcProgram = raffleProgram.compile(false);

    // Extract the validator script address
    const raffleAddress = Address.fromValidatorHash(raffleUplcProgram.validatorHash);
    console.log('valAddr: ' + raffleAddress.toBech32())

    await lockRaffleNft(alice, bruce, raffleAddress, assets, network, networkParams, raffleProgram)

    network.tick(BigInt(10));

    await retrieveNft(bruce, raffleAddress, network, networkParams, raffleProgram, raffleUplcProgram)

    // network.tick(BigInt(10));

    // await joinRaffle(bruce, raffleAddress, network, networkParams, raffleProgram, raffleUplcProgram)

  }

  const lockRaffleNft = async (
    alice: WalletEmulator,
    bruce: WalletEmulator,
    raffleAddress: Address,
    assets: Assets,
    network: NetworkEmulator,
    networkParams: NetworkParams,
    program: Program
  ) => {

    // Lock NFT Prize in contract TX
    const tx = new Tx();

    // NFT and 2 $ada to send to SC
    const nftValue = new Value(BigInt(2_000_000), assets)

    // Datum
    const raffleDatum = new (program.types.Datum)(
      alice.address.pubKeyHash,
      new Value(BigInt(5000000)),
      []
    )

    console.log('DATUM 1: ' + raffleDatum)
    console.log('DATUM 1: ' + raffleDatum.toSchemaJson())

    await tx
      .addInputs(await network.getUtxos(alice.address))
      .addOutput(new TxOutput(raffleAddress, nftValue, Datum.inline(raffleDatum._toUplcData())))
      .finalize(networkParams, alice.address);

    console.log("tx after final", tx.dump());

    console.log("Verifying signature...");
    const signatures = await alice.signTx(tx);
    tx.addSignatures(signatures);

    console.log("Submitting transaction...");
    const txHash = await alice.submitTx(tx);
    console.log('txHash: ' + txHash.hex)

    network.tick(BigInt(10));

    inspectUTxOsAtAddress(alice.address, 'Alice', network)
    inspectUTxOsAtAddress(bruce.address, 'Bruce', network)
    inspectUTxOsAtAddress(raffleAddress, 'Raffle Validation Script', network)

    raffleDatum

  }

  const retrieveNft = async (
    alice: WalletEmulator,
    raffleAddress: Address,
    network: NetworkEmulator,
    networkParams: NetworkParams,
    program: Program,
    uplcProgram: UplcProgram
  ) => {

    const tx = new Tx();

    const scriptUtxos = await network.getUtxos(raffleAddress)
    const nonEmptyDatumUtxo = scriptUtxos.filter(utxo => utxo.origOutput.datum != null)

    if (nonEmptyDatumUtxo.length > 0) {

      const bruceUtxos = await network.getUtxos(alice.address)

      const valRedeemer = new ConstrData(0, []);
      // const valRedeemer = (new (program.types.Redeemer.Admin)([]))._toUplcData()

      const tx = new Tx();
      await tx.addInput(nonEmptyDatumUtxo[0], valRedeemer)
        .addInputs(bruceUtxos)
        .addOutput(new TxOutput(alice.address, nonEmptyDatumUtxo[0].value, nonEmptyDatumUtxo[0].origOutput.datum))
        .attachScript(uplcProgram)
        .addSigner(alice.pubKeyHash)
        .finalize(networkParams, alice.address)

      console.log("tx after final", tx.dump());

      console.log("Verifying signature...");
      const signatures = await alice.signTx(tx);
      tx.addSignatures(signatures);

      console.log("Submitting transaction...");
      const txHash = await alice.submitTx(tx);
      console.log('txHash: ' + txHash.hex)

      network.tick(BigInt(10));

      inspectUTxOsAtAddress(alice.address, 'Alice', network)
      inspectUTxOsAtAddress(raffleAddress, 'Raffle Validation Script', network)

    } else {
      console.log('datum not found')
    }

  }

  const joinRaffle = async (
    bruce: WalletEmulator,
    raffleAddress: Address,
    network: NetworkEmulator,
    networkParams: NetworkParams,
    program: Program,
    uplcProgram: UplcProgram
  ) => {

    const tx = new Tx();

    // Join raffle by paying 5 $ada
    const nftValue = new Value(BigInt(5_000_000))

    const scriptUtxos = await network.getUtxos(raffleAddress)
    const nonEmptyDatumUtxo = scriptUtxos.filter(utxo => utxo.origOutput.datum != null)

    if (nonEmptyDatumUtxo.length > 0) {
      const foo = nonEmptyDatumUtxo[0].origOutput.datum.data as ListData
      const adminPkh = PubKeyHash.fromUplcData(foo.list[0])
      console.log('adminPkh: ' + adminPkh.hex)

      const ticketPrice = Value.fromUplcData(foo.list[1])
      console.log('ticketPrice: ' + ticketPrice.toSchemaJson())

      const participants = (foo.list[2] as ListData).list.map(item => PubKeyHash.fromUplcData(item))
      console.log('participants: ' + participants)

      const newParticipants = participants.slice()
      newParticipants.unshift(bruce.address.pubKeyHash)

      const newDatum = new (program.types.Datum)(
        adminPkh,
        ticketPrice,
        newParticipants
      )

      const input = nonEmptyDatumUtxo[0]

      console.log('DATUM 2: ' + input.origOutput.datum.toData())
      console.log('DATUM 2: ' + input.origOutput.datum.toData().toSchemaJson())

      const bruceUtxos = await network.getUtxos(bruce.address)

      const targetValue = ticketPrice.add(nonEmptyDatumUtxo[0].value)

      // Building redeemer manually
      // const valRedeemer = new ConstrData(1, [bruce.pubKeyHash._toUplcData()]);
      // Using types
      const valRedeemer = (new (program.types.Redeemer.JoinRaffle)(bruce.pubKeyHash))._toUplcData()

      const tx = new Tx();
      await tx.addInput(input, valRedeemer)
        .addInputs(bruceUtxos)
        .addOutput(new TxOutput(raffleAddress, targetValue, Datum.inline(newDatum._toUplcData())))
        .attachScript(uplcProgram)
        .addSigner(bruce.pubKeyHash)
        .finalize(networkParams, bruce.address)

      console.log("tx after final", tx.dump());

      console.log("Verifying signature...");
      const signatures = await bruce.signTx(tx);
      tx.addSignatures(signatures);

      console.log("Submitting transaction...");
      const txHash = await bruce.submitTx(tx);
      console.log('txHash: ' + txHash.hex)

      network.tick(BigInt(10));

      inspectUTxOsAtAddress(bruce.address, 'Alice', network)
      inspectUTxOsAtAddress(raffleAddress, 'Raffle Validation Script', network)

    } else {
      console.log('datum not found')
    }

  }

  const inspectUTxOsAtAddress = async (address: Address, address_name: string, network: NetworkEmulator) => {
    console.log(`------ Address Name ${address_name} ------ `)
    const utxos = await network.getUtxos(address)
    utxos.forEach(utxo => logUtxo(utxo))
  }

  const logUtxo = (utxo: UTxO) => {
    console.log('utxo: ' + utxo.txId.hex)
    console.log('utxo: ' + utxo.utxoIdx)
    console.log('utxo: ' + utxo.value.lovelace)
    if (utxo.value.assets != null) {
      console.log('contains nft? ' + utxo.value.assets.has(nftMph, Array.from(new TextEncoder().encode(nftName))))
    }
    if (utxo.origOutput.datum != null) {
      console.log('datum: ' + utxo.origOutput.datum.data)
      console.log('datum: ' + utxo.origOutput.datum.dump())
      console.log('datum: ' + utxo.origOutput.datum.toData())
    }
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