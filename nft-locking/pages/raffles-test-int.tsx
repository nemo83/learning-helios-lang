
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
  Program,
  Value,
  TxOutput,
  Tx,
  TxId,
  UTxO,
  WalletHelper,
  ByteArray,
  PubKeyHash,
  ValidatorHash
} from "@hyperionbt/helios";

import path from 'path';
import { promises as fs } from 'fs';

declare global {
  interface Window {
    cardano: any;
  }
}

export async function getServerSideProps() {

  try {
    const contractDirectory = path.join(process.cwd(), 'contracts/');

    const fileContents = await fs.readFile(contractDirectory + 'vesting.hl', 'utf8');
    const contractScript = fileContents.toString();

    const fileContents2 = await fs.readFile(contractDirectory + 'lock_nft.hl', 'utf8');
    const contractScript2 = fileContents2.toString();

    const valScript = {
      script: contractScript,
      lockNftScript: contractScript2,
    }

    return { props: valScript }
  } catch (err) {
    console.log('getServerSideProps', err);
  }
  // Contract not found
  return { props: {} };

}

const Home: NextPage = (props: any) => {
  // 1f82f08d08e1e6f32c32dbd47ccffaff06314a07e053a9168eef1486
  // 84e63b95bdf0fcab9d4f48349d641c6616884f0ed8bfcf924b4d3b77
  // export NEXT_PUBLIC_BLOCKFROST_API_KEY="get-your-blockfrost-api-key"
  // export NEXT_PUBLIC_BLOCKFROST_API="https://cardano-preprod.blockfrost.io/api/v0"
  // export NEXT_PUBLIC_NETWORK_PARAMS_URL="https://d1t0d7c2nekuk0.cloudfront.net/preprod.json"

  // TEIKI Helios Code
  // https://github.com/teiki-network/teiki-protocol/blob/main/src/contracts/backing/proof-of-backing.mp/main.ts

  const optimize = false;
  const script = props.script as string;

  // const lockNftScript = props.lockNftScript as string

  const networkParamsUrl = 'https://d1t0d7c2nekuk0.cloudfront.net/preprod.json';
  const blockfrostAPI = 'https://cardano-preprod.blockfrost.io/api/v0';
  const apiKey: string = 'preprod7n2umhQInyWsV1G5okvuuhRBZf3lE05e'; //process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;

  const [walletAPI, setWalletAPI] = useState<undefined | any>(undefined);
  const [tx, setTx] = useState({ txId: '' });
  const [threadToken, setThreadToken] = useState({ tt: '' });
  const [walletInfo, setWalletInfo] = useState({ balance: '' });
  const [walletIsEnabled, setWalletIsEnabled] = useState(false);
  const [whichWalletSelected, setWhichWalletSelected] = useState(undefined);

  const nftName = 'My Cool NFT'

  useEffect(() => {
    const checkWallet = async () => {

      setWalletIsEnabled(await checkIfWalletFound());
    }
    checkWallet();
  }, [whichWalletSelected]);

  useEffect(() => {
    const enableSelectedWallet = async () => {
      if (walletIsEnabled) {
        const api = await enableWallet();
        setWalletAPI(api);
      }
    }
    enableSelectedWallet();
  }, [walletIsEnabled]);

  useEffect(() => {
    const updateWalletInfo = async () => {

      if (walletIsEnabled) {
        const _balance = await getBalance() as string;
        setWalletInfo({
          ...walletInfo,
          balance: _balance
        });
      }
    }
    updateWalletInfo();
  }, [walletAPI]);

  // user selects what wallet to connect to
  const handleWalletSelect = (obj: any) => {
    const whichWalletSelected = obj.target.value
    setWhichWalletSelected(whichWalletSelected);
  }

  const checkIfWalletFound = async () => {

    let walletFound = false;

    const walletChoice = whichWalletSelected;
    if (walletChoice === "nami") {
      walletFound = !!window?.cardano?.nami;
    } else if (walletChoice === "eternl") {
      walletFound = !!window?.cardano?.eternl;
    }
    return walletFound;
  }

  const enableWallet = async () => {

    try {
      const walletChoice = whichWalletSelected;
      if (walletChoice === "nami") {
        const handle: Cip30Handle = await window.cardano.nami.enable();
        const walletAPI = new Cip30Wallet(handle);
        return walletAPI;
      } else if (walletChoice === "eternl") {
        const handle: Cip30Handle = await window.cardano.eternl.enable();
        const walletAPI = new Cip30Wallet(handle);
        return walletAPI;
      }
    } catch (err) {
      console.log('enableWallet error', err);
    }
  }

  const getBalance = async () => {
    try {
      const walletHelper = new WalletHelper(walletAPI);
      const balanceAmountValue = await walletHelper.calcBalance();
      const balanceAmount = balanceAmountValue.lovelace;
      const walletBalance: BigInt = BigInt(balanceAmount);
      return walletBalance.toLocaleString();
    } catch (err) {
      console.log('getBalance error: ', err);
    }
  }

  // Get the utxo with the vesting key token at the script address
  const getKeyUtxo = async (scriptAddress: string, keyMPH: string, keyName: string) => {

    console.log("getKeyUTXO:keyMPH", keyMPH);
    console.log("getKeyUTXO:keyName", keyName);

    const blockfrostUrl: string = blockfrostAPI + "/addresses/" + scriptAddress + "/utxos/" + keyMPH + keyName;
    console.log("blockfrost url", blockfrostUrl);

    let resp = await fetch(blockfrostUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        project_id: apiKey,
      },
    });

    if (resp?.status > 299) {
      throw console.error("vesting key token not found", resp);
    }
    const payload = await resp.json();

    if (payload.length == 0) {
      throw console.error("vesting key token not found");
    }
    const lovelaceAmount = payload[0].amount[0].quantity;
    const mph = MintingPolicyHash.fromHex(keyMPH);
    const tokenName = hexToBytes(keyName);

    const value = new Value(BigInt(lovelaceAmount), new Assets([
      [mph, [
        [tokenName, BigInt(1)],
      ]]
    ]));

    console.log('inline datum: ' + payload[0].inline_datum)

    return new UTxO(
      TxId.fromHex(payload[0].tx_hash),
      BigInt(payload[0].output_index),
      new TxOutput(
        Address.fromBech32(scriptAddress),
        value,
        Datum.inline(ListData.fromCbor(hexToBytes(payload[0].inline_datum)))
      )
    );
  }

  const lockNftScript = `
  spending lock_nft

  struct Datum {
      admin: PubKeyHash
      scriptPkh: PubKeyHash
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
            datum.is_admin(tx).trace("TRACE_IS_ADMIN: ")
        },
        joinRaffle: JoinRaffle => {

          // Test 3 things
          // 1. ticketPrice is paid into the contract (that all that was in the script, + the ticket price , is sent to the datum)
          // 2. uxto where previous datum leaves to be spent
          // 3. new datum is like current + participants contains the pkh of current signer.
          if ( !(tx.is_signed_by(joinRaffle.pkh).trace("TRACE_SIGNED_BY_PARTICIPANT: ")) ) {
            false
          } else {
            
            input: TxOutput = context.get_current_input().output;

            new_datum: Datum = Datum { datum.admin, datum.scriptPkh, datum.ticketPrice, datum.participants.prepend(joinRaffle.pkh) };

            actualTargetValue: Value = tx.value_locked_by_datum(context.get_current_validator_hash(), new_datum, true);

            expectedTargetValue: Value = input.value + datum.ticketPrice;

            (actualTargetValue >= expectedTargetValue).trace("TRACE_ALL_GOOD? ")

          }
        }
    }
  }` as string

  const nftMph = MintingPolicyHash.fromHex(
    'fb3fe93a966f3e3255f2b938859fb7b8e320d9d2d7aee0fc8063dd43'
  )

  // const networkParamsUrl = 'https://d1t0d7c2nekuk0.cloudfront.net/preprod.json';

  const doSomething = async () => {

    const useNetworkEmulator = false;

    // const network = new NetworkEmulator();

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
    // const alice = network.createWallet(BigInt(100_000_000), assets);
    // network.tick(BigInt(10));

    // const bruce = network.createWallet(BigInt(100_000_000));
    // network.tick(BigInt(10));

    // console.log('Alice PKH: ' + alice.pubKeyHash.hex)
    // console.log('Bruce PKH: ' + bruce.pubKeyHash.hex)

    // network.tick(BigInt(10));


    // Compile the helios minting script
    const raffleProgram = Program.new(lockNftScript);
    const raffleUplcProgram = raffleProgram.compile(false);

    // Extract the validator script address
    const raffleAddress = Address.fromValidatorHash(raffleUplcProgram.validatorHash);
    console.log('valAddr: ' + raffleAddress.toBech32())

    const addHex = raffleAddress.bytes.slice(1)
    console.log('addHex: ' + addHex)

    const valHex = raffleUplcProgram.validatorHash.bytes
    console.log('valHex: ' + valHex)

    const eq = addHex == valHex
    console.log('eq : ' + eq)

    // await lockRaffleNft(alice, bruce, raffleAddress, assets, network, networkParams, raffleProgram)

    // network.tick(BigInt(10));

    // await retrieveNft(bruce, raffleAddress, network, networkParams, raffleProgram, raffleUplcProgram)

    // network.tick(BigInt(10));

    // await joinRaffle(bruce, raffleAddress, network, networkParams, raffleProgram, raffleUplcProgram)

  }

  const lockRaffleNft = async () => {

    const networkParams = new NetworkParams(
      await fetch(networkParamsUrl)
        .then(response => response.json())
    )

    // Compile the helios minting script
    const raffleProgram = Program.new(lockNftScript);
    const raffleUplcProgram = raffleProgram.compile(false);

    // Extract the validator script address
    const raffleAddress = Address.fromValidatorHash(raffleUplcProgram.validatorHash);
    console.log('valAddr: ' + raffleAddress.toBech32())

    const walletHelper = new WalletHelper(walletAPI);
    const walletBaseAddress = await walletHelper.baseAddress

    // Lock NFT Prize in contract TX
    const tx = new Tx();

    const assets = new Assets();

    assets.addComponent(
      nftMph,
      Array.from(new TextEncoder().encode(nftName)),
      BigInt(1)
    );

    // NFT and 2 $ada to send to SC
    const nftValue = new Value(BigInt(2_000_000), assets)

    // Datum
    const raffleDatum = new (raffleProgram.types.Datum)(
      walletBaseAddress.pubKeyHash,
      raffleUplcProgram.validatorHash.bytes,
      new Value(BigInt(5000000)),
      []
    )

    console.log('DATUM 1: ' + raffleDatum)
    console.log('DATUM 1: ' + raffleDatum.toSchemaJson())

    const walletUtxos = await walletHelper.pickUtxos(nftValue)

    await tx
      .addInputs(walletUtxos[0])
      .addOutput(new TxOutput(raffleAddress, nftValue, Datum.inline(raffleDatum._toUplcData())))
      .finalize(networkParams, await walletHelper.changeAddress, walletUtxos[1]);

    console.log("tx after final", tx.dump());

    console.log("Verifying signature...");
    const signatures = await walletAPI.signTx(tx);
    tx.addSignatures(signatures);

    console.log("Submitting transaction...");
    const txHash = await walletAPI.submitTx(tx);
    console.log('txHash: ' + txHash.hex)


    raffleDatum

  }

  const retrieveNft = async () => {

    const networkParams = new NetworkParams(
      await fetch(networkParamsUrl)
        .then(response => response.json())
    )

    // Compile the helios minting script
    const raffleProgram = Program.new(lockNftScript);
    const raffleUplcProgram = raffleProgram.compile(false);

    // Extract the validator script address
    const raffleAddress = Address.fromValidatorHash(raffleUplcProgram.validatorHash);
    console.log('valAddr: ' + raffleAddress.toBech32())

    const walletHelper = new WalletHelper(walletAPI);
    const walletBaseAddress = await walletHelper.baseAddress


    const contractUtxo = await getKeyUtxo(raffleAddress.toBech32(), nftMph.hex, ByteArrayData.fromString(nftName).toHex())

    // const nonEmptyDatumUtxo = contractUtxo.filter(utxo => utxo.origOutput.datum != null)

    const walletUtxos = await walletHelper.pickUtxos(new Value(BigInt(1_000_000)))

    const valRedeemer = new ConstrData(0, []);
    // const valRedeemer = (new (program.types.Redeemer.Admin)([]))._toUplcData()

    const tx = new Tx();
    await tx.addInput(contractUtxo, valRedeemer)
      .addInputs(walletUtxos[0])
      .addOutput(new TxOutput(walletBaseAddress, contractUtxo.value))
      .attachScript(raffleUplcProgram)
      .addSigner(walletBaseAddress.pubKeyHash)
      .finalize(networkParams, await walletHelper.changeAddress, walletUtxos[1])

    console.log("tx after final", tx.dump());

    console.log("Verifying signature...");
    const signatures = await walletAPI.signTx(tx);
    tx.addSignatures(signatures);

    console.log("Submitting transaction...");
    const txHash = await walletAPI.submitTx(tx);
    console.log('txHash: ' + txHash.hex)


  }

  const joinRaffle = async () => {

    const networkParams = new NetworkParams(
      await fetch(networkParamsUrl)
        .then(response => response.json())
    )

    // Compile the helios minting script
    const raffleProgram = Program.new(lockNftScript);
    const raffleUplcProgram = raffleProgram.compile(false);
    console.log('raffleUplcProgram.validatorHash ' + raffleUplcProgram.validatorHash.hex)


    // Extract the validator script address
    const raffleAddress = Address.fromValidatorHash(raffleUplcProgram.validatorHash);
    console.log('valAddr: ' + raffleAddress.toBech32())
    console.log('valAddr.bytes: ' + raffleAddress.toHex())



    const walletHelper = new WalletHelper(walletAPI);
    const walletBaseAddress = await walletHelper.baseAddress

    // Join raffle by paying 5 $ada
    const nftValue = new Value(BigInt(5_000_000))
    const walletUtxos = await walletHelper.pickUtxos(nftValue)

    const contractUtxo = await getKeyUtxo(raffleAddress.toBech32(), nftMph.hex, ByteArrayData.fromString(nftName).toHex())

    const foo = contractUtxo.origOutput.datum.data as ListData
    const adminPkh = PubKeyHash.fromUplcData(foo.list[0])
    console.log('adminPkh: ' + adminPkh.hex)

    const valHash = ValidatorHash.fromUplcData(foo.list[1])
    console.log('adminPkh: ' + adminPkh.hex)

    const ticketPrice = Value.fromUplcData(foo.list[2])
    console.log('ticketPrice: ' + ticketPrice.toSchemaJson())

    const participants = (foo.list[3] as ListData).list.map(item => PubKeyHash.fromUplcData(item))
    console.log('participants: ' + participants)

    const newParticipants = participants.slice()
    newParticipants.unshift(walletBaseAddress.pubKeyHash)
    console.log('newParticipants: ' + newParticipants)

    const newDatum = new (raffleProgram.types.Datum)(
      adminPkh,
      valHash.bytes,
      ticketPrice,
      newParticipants
    )

    const targetValue = ticketPrice.add(contractUtxo.value)

    const ge = targetValue.ge(contractUtxo.value)

    console.log('ge? ' + ge)

    // Building redeemer manually
    // const valRedeemer = new ConstrData(1, [bruce.pubKeyHash._toUplcData()]);
    // Using types
    const valRedeemer = (new (raffleProgram.types.Redeemer.JoinRaffle)(walletBaseAddress.pubKeyHash))._toUplcData()

    const tx = new Tx();
    tx.body.setFee(BigInt(2_000_000))
    tx.addInput(contractUtxo, valRedeemer)
      .addInputs(walletUtxos[0])
      .addOutput(new TxOutput(raffleAddress, targetValue, Datum.inline(newDatum._toUplcData())))
      .attachScript(raffleUplcProgram)
      .addSigner(walletBaseAddress.pubKeyHash)

    console.log("tx before final", tx.dump());

    await tx.finalize(networkParams, await walletHelper.changeAddress, walletUtxos[1])

    console.log("tx after final", tx.dump());

    console.log("Verifying signature...");
    const signatures = await walletAPI.signTx(tx);
    tx.addSignatures(signatures);

    console.log("Submitting transaction...");
    const txHash = await walletAPI.submitTx(tx);
    console.log('txHash: ' + txHash.hex)

  }


  return (
    <div className={styles.container}>
      <Head>
        <title>Helios Tx Builder</title>
        <meta name="description" content="Littercoin web tools page" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h3 className={styles.title}>
          Helios Tx Builder
        </h3>

        <div className={styles.borderwallet}>
          <p>
            Connect to your wallet
          </p>
          <p className={styles.borderwallet}>
            <input type="radio" id="nami" name="wallet" value="nami" onChange={handleWalletSelect} />
            <label>Nami</label>
          </p>

        </div>
        <div className={styles.borderwallet}>
          View Smart Contract:  &nbsp;  &nbsp;
          <a href="/api/vesting" target="_blank" rel="noopener noreferrer">vesting.hl</a>
        </div>
        {!tx.txId && walletIsEnabled && <div className={styles.border}><WalletInfo walletInfo={walletInfo} /></div>}
        {tx.txId && <div className={styles.border}><b>Transaction Success!!!</b>
          <p>TxId &nbsp;&nbsp;<a href={"https://preprod.cexplorer.io/tx/" + tx.txId} target="_blank" rel="noopener noreferrer" >{tx.txId}</a></p>
          <p>Please wait until the transaction is confirmed on the blockchain and reload this page before doing another transaction</p>
          <p></p>
        </div>}
        {threadToken.tt && <div className={styles.border}>
          <p>Please copy and save your vesting key</p>
          <b><p>{threadToken.tt}</p></b>
          <p>You will need this key to unlock your funds</p>
        </div>}

        {walletIsEnabled ? (
          <input type='button' value='Do Something' onClick={() => doSomething()} />
        ) : null}
        {walletIsEnabled ? (
          <input type='button' value='Lock NFT' onClick={() => lockRaffleNft()} />
        ) : null}
        {walletIsEnabled ? (
          <input type='button' value='Retrieve NFT' onClick={() => retrieveNft()} />
        ) : null}
        {walletIsEnabled ? (
          <input type='button' value='Join Raffle' onClick={() => joinRaffle()} />
        ) : null}


      </main>

      <footer className={styles.footer}>

      </footer>
    </div>
  )
}

export default Home