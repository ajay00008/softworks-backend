import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AnswerSheet } from '../models/AnswerSheet.js';
import logger from '../utils/logger.js';

async function fixAnswerSheetDuplicates() {
  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info('Connected to MongoDB');

    const examId = new mongoose.Types.ObjectId('69025e81b281f27e8b1ff93b');
    const studentId = new mongoose.Types.ObjectId('6900dd4d8ea123350a57c348');

    // Find all answer sheets for this exam and student
    const duplicates = await AnswerSheet.find({
      examId,
      studentId
    });

    logger.info(`Found ${duplicates.length} answer sheet(s) for exam ${examId} and student ${studentId}`);

    if (duplicates.length > 0) {
      // Delete all except the most recent one (or delete all if you want)
      const sorted = duplicates.sort((a, b) => {
        const aDate = a.uploadedAt || (a as any).createdAt || new Date();
        const bDate = b.uploadedAt || (b as any).createdAt || new Date();
        return bDate.getTime() - aDate.getTime();
      });

      // Delete all duplicates
      for (const sheet of duplicates) {
        logger.info(`Deleting answer sheet ${sheet._id} (uploaded: ${sheet.uploadedAt})`);
        await AnswerSheet.findByIdAndDelete(sheet._id);
      }

      logger.info(`Deleted ${duplicates.length} duplicate answer sheet(s)`);
    }

    // Try to drop the old index if it exists
    try {
      const collection = mongoose.connection.db?.collection('answersheets');
      if (collection) {
        const indexes = await collection.indexes();
        const oldIndex = indexes.find(idx => idx.name === 'examId_1_studentId_1');
        
        if (oldIndex) {
          logger.info('Dropping old index: examId_1_studentId_1');
          await collection.dropIndex('examId_1_studentId_1');
          logger.info('Old index dropped successfully');
        } else {
          logger.info('Old index not found, skipping');
        }
      }
    } catch (indexError: any) {
      logger.warn(`Could not drop old index (might not exist): ${indexError.message}`);
    }

    logger.info('Fix completed successfully');
    process.exit(0);
  } catch (error: unknown) {
    logger.error('Error fixing duplicates:', error);
    process.exit(1);
  }
}

fixAnswerSheetDuplicates();

