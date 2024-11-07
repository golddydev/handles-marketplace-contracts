export const marketplaceContract = `
spending marketplace

// ---------- Datum ----------

// A listing requires a datum that has
// the owner's payment key and a list of payouts.
// We do not need to specify the marketplace payout
// in 'payouts' even though it will be in
// one of the outputs.

struct Payout {
    address: ByteArray
    amount_lovelace: Int
}

struct Datum {
    // Does not contain the marketplace payout.
    // This is usually royalty and seller payouts.
    payouts: []Payout
    /// Flexible to allow discounts
    /// The key that listed the NFT
    owner: ByteArray
}

// ---------- Redeemer ----------

/// A user can either buy a token
/// or cancel/update the listing.
enum Redeemer {
    /// 'payout_outputs_offset' tells us where
    /// the outputs containing the payouts start.
    Buy {
        payout_outputs_offset: Int 
    }
    /// Cancel or update a listing.
    WithdrawOrUpdate
}

// ---------- Parameters ----------
const AUTHORIZERS: []PubKeyHash = []PubKeyHash{
    PubKeyHash::new(#)
}
const MARKETPLACE_ADDRESS: Address = Address::from_bytes(#)

// ---------- Functions ----------

func find_payout_outputs(outputs: []TxOutput, payout_outputs_offset: Int) -> []TxOutput {
    if (payout_outputs_offset == 0) {
        outputs
    } else {
        find_payout_outputs(outputs.tail, payout_outputs_offset - 1)
    }
}


func check_payouts_aux(outputs: []TxOutput, payouts: []Payout) -> Int {
    first_output: TxOutput = outputs.head;
    rest_outputs: []TxOutput = outputs.tail;

    assert(first_output.datum == OutputDatum::new_none(), "Rest outputs' datum must be None");

    payout: Payout = payouts.head;
    rest_payouts: []Payout = payouts.tail;
  
    Payout { payout_address, amount_lovelace } = payout;
  
    // The 'Output' address must match
    // the address specified in the corresponding
    // payout from the datum.
    assert(Address::from_bytes(payout_address) == first_output.address, "Output address must be matched with payout");
    // Amount of lovelace in payout datum
    // must be greather than 0
    assert(amount_lovelace > 0, "Payout amount must be greatner than 0");

    // The output value must be equal to or greather than
    // payout lovelace amount specified in the
    // corresponding payout from the datum.
    expected_output_value = Value::new(AssetClass::ADA, amount_lovelace);
    assert(first_output.value.contains(expected_output_value), "Amount Lovelace from payout must be paid to output");

    // prevent token spamming
    assert(first_output.value.get_assets() == Value::ZERO, "Must pay with only lovelace");

    rest_payouts_amount: Int = (
        if (rest_payouts.is_empty()) {
            // the base case
            // if rest is empty we are done
            0
        } else {
            check_payouts_aux(rest_outputs, rest_payouts)
        }
    );

    amount_lovelace + rest_payouts_amount
}

/// Check that payouts and payout outputs
/// are correct. Payouts are stored in the datum
/// when assets are listed. On buy a transaction
/// with matching payout outputs needs to be constructed.
/// We also require that outputs are in the same order as the
/// payouts in the datum. Returns the sum of the payout amounts.
func check_payouts(outputs: []TxOutput, payouts: []Payout, datum_tag: OutputDatum) -> Int {
    first_output: TxOutput = outputs.head;
    rest_outputs: []TxOutput = outputs.tail;

    assert(first_output.datum == datum_tag, "First output's datum must be matched datum tag");

    payout: Payout = payouts.head;
    rest_payouts: []Payout = payouts.tail;
    Payout { payout_address, amount_lovelace } = payout;

    // The 'Output' address must match
    // the address specified in the corresponding
    // payout from the datum.
    assert(Address::from_bytes(payout_address) == first_output.address, "First output address must be matched with payout");

    // Amount of lovelace in payout datum
    // must be greather than 0
    assert(amount_lovelace > 0, "Payout amount must be greatner than 0");

    // The output value must be equal to or greather than
    // payout lovelace amount specified in the
    // corresponding payout from the datum.
    expected_output_value = Value::new(AssetClass::ADA, amount_lovelace);
    assert(first_output.value.contains(expected_output_value), "Amount lovelace from payout must be paid to output");

    // prevent token spamming
    assert(first_output.value.get_assets() == Value::ZERO, "Must pay with only lovelace");

    rest_payouts_amount: Int = (
        if (rest_payouts.is_empty()) {
            // the base case
            // if rest is empty we are done
            0
        } else {
            check_payouts_aux(rest_outputs, rest_payouts)
        }
    );

    amount_lovelace + rest_payouts_amount
}

/// This function is used only if a discount
/// is not allowed (tx not signed by jpg). The main difference
/// from 'check_payouts' is that we make sure the
/// output address matches a hardcoded marketplace address
/// along with confirming that the output value equals
/// the marketplace_fee. In this case there is no 'Payout'
/// to compare to.
func check_marketplace_payout(output: TxOutput, marketplace_fee: Int, datum_tag: OutputDatum) -> Bool {
    assert(output.datum == datum_tag, "Marketplace fee output's datum must be match datum tag");

    // Match constant marketplace address
    assert(output.address == MARKETPLACE_ADDRESS, "Marketplace address must be correct");
  
    // Output value quantity must equal the marketplace fee
    // this prevents people from not paying a fee by submitting
    // transactions not constructed by Jpg.
    expected_output_value: Value = Value::new(AssetClass::ADA, marketplace_fee);
    assert(output.value.contains(expected_output_value), "Marketplace fee must be paid");

    // prevent token spamming
    assert(output.value.get_assets() == Value::ZERO, "Must pay with only lovelace");

    true
}

// ---------- Main Function ----------

func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
    /// Validate that the signer is the owner or that payouts
    /// are present as outputs and that the tag is correct.
    tx: Tx = ctx.tx;
    spending_output_ref: TxOutputId = ctx.get_spending_purpose_output_id();
    redeemer.switch {
        Buy { payout_outputs_offset } => {
            // to prevent double satisfaction
            datum_tag: OutputDatum::Inline = OutputDatum::new_inline(spending_output_ref.serialize().blake2b());

            Datum { payouts, _ } = datum;
            // Find the 'outputs' that correspond to 'payouts'.
            payout_outputs: []TxOutput = find_payout_outputs(tx.outputs, payout_outputs_offset);

            // We can ignore the fee check
            // if any of the authorizers have signed the tx.
            can_have_discount: Bool = AUTHORIZERS.any((authorizer: PubKeyHash) -> Bool {
                tx.is_signed_by(authorizer)
            });

            // If 'can_have_discount' is 'True' then we can
            // assume that jpg properly calculated the fee off chain.
            if (can_have_discount) {
                check_payouts(payout_outputs, payouts, datum_tag) > 0
            } else {
                // When there is a marketplace fee we can assume
                // it is the first of the 'payout_outputs'.
                marketplace_output: TxOutput = payout_outputs.head;
                rest_outputs: []TxOutput = payout_outputs.tail;
      
                payouts_sum: Int = check_payouts(rest_outputs, payouts, OutputDatum::new_none());
      
                // This approximates the marketplace fee given only the payouts to a very high degree.
                // For a payouts in excess of 100k ada the error is less than 40000 lovelace.
                marketplace_fee: Int = payouts_sum * 50 / 49 / 50;

                // Make sure that the marketplace output
                // is correct.
                check_marketplace_payout(marketplace_output, marketplace_fee, datum_tag)
            }
        },
        WithdrawOrUpdate => {
            // There's not much to do here. An asset
            // owner can cancel or update their listing
            // at any time.
            // is signed by owner
            assert(tx.is_signed_by(PubKeyHash::new(datum.owner)), "Must be signed by owner");
            true
        }
    }
}
`;
