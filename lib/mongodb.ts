import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI!
let client: MongoClient

export async function connectToMongoDB() {
  if (!client) {
    client = new MongoClient(uri)
    await client.connect()
  }
  return client
}
