import { buy, BuyConfig, buyWithAuth, BuyWithAuthConfig } from "../buy";
import program from "../cli";
import { loadConfig } from "../config";
import { deployedScripts } from "../deployed";

import * as helios from "@koralabs/helios";

program
  .command("buy")
  .description("Buy Handle NFT on Marketplace")
  .argument("<address>", "Address to perform buying")
  .argument("<utxo-tx-hash>", "Transaction Hash of UTxO where handle is")
  .argument("<utxo-tx-index>", "Transaction Index of UTxO where handle is")
  .action(async (bech32Address: string, txHash: string, txIndex: string) => {
    const configResult = loadConfig();
    if (!configResult.ok) return program.error(configResult.error);
    const config = configResult.data;

    const api = new helios.BlockfrostV0(
      config.network,
      config.blockfrostApiKey
    );
    const utxos = await api.getUtxos(helios.Address.fromBech32(bech32Address));
    const handleUtxo = await api.getUtxo(
      new helios.TxOutputId(`${txHash}#${txIndex}`)
    );

    const refScriptDetail = Object.values(deployedScripts[config.network])[0];
    const refScriptUTxo = await api.getUtxo(
      new helios.TxOutputId(refScriptDetail.refScriptUtxo!)
    );
    const refScriptCborUtxo = Buffer.from(refScriptUTxo.toFullCbor()).toString(
      "hex"
    );

    const buyConfig: BuyConfig = {
      changeBech32Address: bech32Address,
      cborUtxos: utxos.map((utxo) =>
        Buffer.from(utxo.toFullCbor()).toString("hex")
      ),
      handleCborUtxo: Buffer.from(handleUtxo.toFullCbor()).toString("hex"),
      refScriptDetail,
      refScriptCborUtxo,
    };

    const txResult = await buy(buyConfig, config.network);
    if (!txResult.ok) return program.error(txResult.error);
    console.log("\nTransaction CBOR Hex, copy and paste to wallet\n");
    console.log(txResult.data.toCborHex());
  });

program
  .command("buy-with-auth")
  .description("Buy Handle NFT on Marketplace with Authorizer")
  .argument("<address>", "Address to perform buying")
  .argument("<utxo-tx-hash>", "Transaction Hash of UTxO where handle is")
  .argument("<utxo-tx-index>", "Transaction Index of UTxO where handle is")
  .action(async (bech32Address: string, txHash: string, txIndex: string) => {
    const configResult = loadConfig();
    if (!configResult.ok) return program.error(configResult.error);
    const config = configResult.data;

    const api = new helios.BlockfrostV0(
      config.network,
      config.blockfrostApiKey
    );
    const utxos = await api.getUtxos(helios.Address.fromBech32(bech32Address));
    const handleUtxo = await api.getUtxo(
      new helios.TxOutputId(`${txHash}#${txIndex}`)
    );

    const refScriptDetail = Object.values(deployedScripts[config.network])[0];
    const refScriptUTxo = await api.getUtxo(
      new helios.TxOutputId(refScriptDetail.refScriptUtxo!)
    );
    const refScriptCborUtxo = Buffer.from(refScriptUTxo.toFullCbor()).toString(
      "hex"
    );

    const buyWithAuthConfig: BuyWithAuthConfig = {
      changeBech32Address: bech32Address,
      cborUtxos: utxos.map((utxo) =>
        Buffer.from(utxo.toFullCbor()).toString("hex")
      ),
      handleCborUtxo: Buffer.from(handleUtxo.toFullCbor()).toString("hex"),
      authorizerPubKeyHash: config.paramters.authorizers[0],
      refScriptDetail,
      refScriptCborUtxo,
    };

    const txResult = await buyWithAuth(buyWithAuthConfig, config.network);
    if (!txResult.ok) return program.error(txResult.error);
    console.log("\nTransaction CBOR Hex, copy and paste to wallet\n");
    console.log(txResult.data.toCborHex());
  });
