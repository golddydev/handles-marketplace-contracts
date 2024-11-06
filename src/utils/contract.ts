import { getDirname } from "../helpers";
import { Parameters } from "../types";

import * as helios from "@koralabs/helios";
import { Network } from "@koralabs/kora-labs-common";
import fs from "fs/promises";
import path from "path";

const dirname = getDirname(import.meta.url);
const contractPath = path.join(dirname, "../contract/marketplace.helios");

const getHeliosProgram = async (
  parameters: Parameters
): Promise<helios.Program> => {
  const contractFile = (await fs.readFile(contractPath)).toString();
  const program = helios.Program.new(contractFile);
  program.parameters.AUTHORIZERS = parameters.authorizers.map((authorizer) =>
    helios.PubKeyHash.fromHex(authorizer)
  );
  program.parameters.MARKETPLACE_ADDRESS = helios.Address.fromBech32(
    parameters.marketplaceAddress
  );
  return program;
};

const getUplcProgram = async (
  parameters: Parameters,
  optimize: boolean = false
): Promise<helios.UplcProgram> => {
  const program = await getHeliosProgram(parameters);

  return program.compile(optimize);
};

const getUplcProgramDetail = async (
  network: Network,
  parameters: Parameters,
  optimize: boolean = false
): Promise<{ cbor: string; hash: string; address: string }> => {
  const uplcProgram = await getUplcProgram(parameters, optimize);
  const cbor = helios.bytesToHex(uplcProgram.toCbor());
  const hash = helios.bytesToHex(uplcProgram.hash());
  const address = helios.Address.fromHash(
    helios.PubKeyHash.fromHex(hash),
    network != "mainnet"
  ).toBech32();
  return {
    cbor,
    hash,
    address,
  };
};

export { getHeliosProgram, getUplcProgram, getUplcProgramDetail };
