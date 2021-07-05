const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let addressTxSchema = new Schema(
    {
        address: {
            type: String
        },
        txId: {
            type: String,
        },
        type: {
            type: Boolean,
        }
    },
    { collection: "AddressTx" }
);

module.exports = {
    addressTxModel: mongoose.model("addressTx", addressTxSchema),
    addressTxSchema,
};
