const mongoose = require("mongoose");

const Schema = mongoose.Schema;

let blockSchema = new Schema(
    {
        height: {
            type: Number
        },
        hash: {
            type: String
        },
        data: {
            type: Object
        }
    },
    { collection: "Block" }
);

module.exports = {
    blockModel: mongoose.model("Block", blockSchema),
    blockSchema
};
