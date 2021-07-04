const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let chainSchema = new Schema(
    {
        height: {
            type: Number
        },
        hash: {
            type: String
        },
    },
    { collection: "Chain" }
);

module.exports = {
    chainModel: mongoose.model("chain", chainSchema),
    chainSchema,
};
