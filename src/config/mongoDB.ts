import mongoose from "mongoose";

const connectMongoDB = async (url: string) => {
  try {
    await mongoose.connect(url);
    console.log("Successfully connected to MongoDB 🍃");
  } catch (error) {
    console.log("Couldn't connect to MongoDB❌:", error);
    process.exit(1);
  }
};

export default connectMongoDB;
