const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let addressSchema = new Schema(
    {
        address: {
            type: String
        },
        balance: {
            type: Number
        },
        nonce: {
            type: Number
        },
        transactions: {
            type: mongoose.ObjectId,
            ref:  "Tx"
        }
    },
    { collection: "Address" }
);

module.exports = {
    addressModel: mongoose.model("address", addressSchema),
    addressSchema,
};
