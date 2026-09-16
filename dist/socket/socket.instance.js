"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketIO = exports.setSocketIO = void 0;
let socketIO = null;
const setSocketIO = (io) => {
    socketIO = io;
    console.log("Socket.IO instance stored");
};
exports.setSocketIO = setSocketIO;
const getSocketIO = () => {
    if (!socketIO) {
        throw new Error("Socket.IO is not initialized");
    }
    return socketIO;
};
exports.getSocketIO = getSocketIO;
