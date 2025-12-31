import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../../.env") });

async function migrateUnreadCount() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const conversationsCollection = db.collection("conversations");

    // Find all conversations with Map-style unreadCount
    const conversationsToMigrate = await conversationsCollection
      .find({
        unreadCount: { $type: "object", $not: { $type: "array" } },
      })
      .toArray();

    console.log(
      `Found ${conversationsToMigrate.length} conversations to migrate`
    );

    let migratedCount = 0;

    for (const conversation of conversationsToMigrate) {
      const newUnreadCount = [];

      // Convert Map to Array
      if (
        conversation.unreadCount &&
        typeof conversation.unreadCount === "object"
      ) {
        for (const [userId, count] of Object.entries(
          conversation.unreadCount
        )) {
          newUnreadCount.push({
            user: new mongoose.Types.ObjectId(userId),
            count: Number(count) || 0,
          });
        }
      }

      // Update the conversation
      await conversationsCollection.updateOne(
        { _id: conversation._id },
        { $set: { unreadCount: newUnreadCount } }
      );

      migratedCount++;
      console.log(`Migrated conversation ${conversation._id}`);
    }

    console.log(`✅ Successfully migrated ${migratedCount} conversations`);
    console.log("Migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
}

migrateUnreadCount();
