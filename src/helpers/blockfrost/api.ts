import {
  BlockfrostV0Client,
  makeBlockfrostV0Client,
} from "@helios-lang/tx-utils";

import { getNetwork } from "./network.js";

const getBlockfrostApi = (blockfrostApiKey: string): BlockfrostV0Client => {
  const network = getNetwork(blockfrostApiKey);
  return makeBlockfrostV0Client(network, blockfrostApiKey);
};

export { getBlockfrostApi };
