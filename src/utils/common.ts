import mainnetParams from "./params/mainnet.json";
import preprodParams from "./params/preprod.json";
import previewParams from "./params/preview.json";

import * as helios from "@koralabs/helios";
import { Network } from "@koralabs/kora-labs-common";
import Decimal from "decimal.js";

const adaToLovelace = (ada: number): bigint =>
  BigInt(new Decimal(ada).mul(Math.pow(10, 6)).floor().toString());

const fetchNetworkParameters = (network: Network): helios.NetworkParams => {
  if (network == "mainnet") return new helios.NetworkParams(mainnetParams);
  if (network == "preprod") return new helios.NetworkParams(preprodParams);
  return new helios.NetworkParams(previewParams);
};

export { adaToLovelace, fetchNetworkParameters };
