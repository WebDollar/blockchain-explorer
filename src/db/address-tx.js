const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let addressTxSchema = new Schema(
    {
        address: {
            type: String,
            index: true,
        },
        tx: {
            type: mongoose.ObjectId,
            ref:  "Tx"
        },
        txId: {
            type: String,
            index: true,
        },
        type: {
            type: Boolean,
        },
        blockHeight:{
            type: Number,
            index: true,
        },
        txHeight:{
            type: Number,
            index: true,
        },
    },
    { collection: "AddressTx" }
);

module.exports = {
    addressTxModel: mongoose.model("AddressTx", addressTxSchema),
    addressTxSchema,
};
