import { z } from "zod";
import createHttpError from "http-errors";
import { Result } from "../models/Result";
import { Exam } from "../models/Exam";
import { Student } from "../models/Student";
import { Class } from "../models/Class";
const SendResultsSchema = z.object({
    examId: z.string().min(1),
    studentIds: z.array(z.string()).optional(), // If not provided, send to all students
    communicationMethod: z.enum(["EMAIL", "WHATSAPP", "BOTH"]),
    message: z.string().optional(),
    includeAnswers: z.boolean().default(false),
    includeStatistics: z.boolean().default(false)
});
const SendBulkMessageSchema = z.object({
    studentIds: z.array(z.string()).optional(),
    classId: z.string().optional(),
    communicationMethod: z.enum(["EMAIL", "WHATSAPP", "BOTH"]),
    subject: z.string().min(1),
    message: z.string().min(1),
    scheduledAt: z.string().transform(str => new Date(str)).optional()
});
// Send Results to Parents
export async function sendResultsToParents(req, res, next) {
    try {
        const { examId, studentIds, communicationMethod, message, includeAnswers, includeStatistics } = SendResultsSchema.parse(req.body);
        const exam = await Exam.findById(examId)
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section');
        if (!exam)
            throw new createHttpError.NotFound("Exam not found");
        // Get results for specified students or all students in the class
        let query = { examId };
        if (studentIds && studentIds.length > 0) {
            query.studentId = { $in: studentIds };
        }
        const results = await Result.find(query)
            .populate('studentId', 'name email')
            .populate('answers.questionId');
        // Get student details with parent information
        const students = await Student.find({
            userId: { $in: results.map(r => r.studentId) }
        }).populate('userId', 'name email');
        const communicationResults = [];
        for (const result of results) {
            const student = students.find(s => s.userId.toString() === result.studentId.toString());
            if (!student)
                continue;
            // Prepare result data
            const resultData = {
                student: {
                    name: result.studentId.name,
                    rollNumber: student.rollNumber,
                    class: student.classId
                },
                exam: {
                    title: exam.title,
                    examType: exam.examType,
                    subject: exam.subjectId,
                    class: exam.classId,
                    totalMarks: exam.totalMarks,
                    scheduledDate: exam.scheduledDate
                },
                result: {
                    totalMarksObtained: result.totalMarksObtained,
                    percentage: result.percentage,
                    grade: result.grade,
                    submissionStatus: result.submissionStatus,
                    submittedAt: result.submittedAt,
                    isAbsent: result.isAbsent,
                    isMissingSheet: result.isMissingSheet,
                    answers: includeAnswers ? result.answers.map(answer => ({
                        question: answer.questionId.questionText,
                        answer: answer.answer,
                        isCorrect: answer.isCorrect,
                        marksObtained: answer.marksObtained
                    })) : undefined
                }
            };
            // Send via email
            if (communicationMethod === "EMAIL" || communicationMethod === "BOTH") {
                if (student.parentsEmail) {
                    const emailResult = await sendEmailResult(student.parentsEmail, resultData, message);
                    communicationResults.push({
                        studentId: result.studentId,
                        method: "EMAIL",
                        status: emailResult.success ? "SENT" : "FAILED",
                        error: emailResult.error
                    });
                }
                else {
                    communicationResults.push({
                        studentId: result.studentId,
                        method: "EMAIL",
                        status: "FAILED",
                        error: "No parent email found"
                    });
                }
            }
            // Send via WhatsApp
            if (communicationMethod === "WHATSAPP" || communicationMethod === "BOTH") {
                if (student.whatsappNumber) {
                    const whatsappResult = await sendWhatsAppResult(student.whatsappNumber, resultData, message);
                    communicationResults.push({
                        studentId: result.studentId,
                        method: "WHATSAPP",
                        status: whatsappResult.success ? "SENT" : "FAILED",
                        error: whatsappResult.error
                    });
                }
                else {
                    communicationResults.push({
                        studentId: result.studentId,
                        method: "WHATSAPP",
                        status: "FAILED",
                        error: "No WhatsApp number found"
                    });
                }
            }
        }
        // Add statistics if requested
        let statistics = null;
        if (includeStatistics) {
            statistics = {
                totalStudents: results.length,
                averageMarks: results.reduce((sum, r) => sum + r.totalMarksObtained, 0) / results.length,
                averagePercentage: results.reduce((sum, r) => sum + r.percentage, 0) / results.length,
                passedStudents: results.filter(r => r.percentage >= 40).length,
                absentStudents: results.filter(r => r.isAbsent).length,
                missingSheets: results.filter(r => r.isMissingSheet).length
            };
        }
        res.json({
            success: true,
            message: "Results sent successfully",
            communicationResults,
            statistics,
            metadata: {
                examId,
                totalStudents: results.length,
                communicationMethod,
                sentAt: new Date()
            }
        });
    }
    catch (err) {
        next(err);
    }
}
// Send Bulk Message to Parents
export async function sendBulkMessage(req, res, next) {
    try {
        const { studentIds, classId, communicationMethod, subject, message, scheduledAt } = SendBulkMessageSchema.parse(req.body);
        let students;
        if (studentIds && studentIds.length > 0) {
            // Send to specific students
            students = await Student.find({
                userId: { $in: studentIds }
            }).populate('userId', 'name email');
        }
        else if (classId) {
            // Send to all students in class
            students = await Student.find({
                classId
            }).populate('userId', 'name email');
        }
        else {
            throw new createHttpError.BadRequest("Either studentIds or classId must be provided");
        }
        const communicationResults = [];
        for (const student of students) {
            // Send via email
            if (communicationMethod === "EMAIL" || communicationMethod === "BOTH") {
                if (student.parentsEmail) {
                    const emailResult = await sendEmailMessage(student.parentsEmail, subject, message, student);
                    communicationResults.push({
                        studentId: student.userId,
                        method: "EMAIL",
                        status: emailResult.success ? "SENT" : "FAILED",
                        error: emailResult.error
                    });
                }
                else {
                    communicationResults.push({
                        studentId: student.userId,
                        method: "EMAIL",
                        status: "FAILED",
                        error: "No parent email found"
                    });
                }
            }
            // Send via WhatsApp
            if (communicationMethod === "WHATSAPP" || communicationMethod === "BOTH") {
                if (student.whatsappNumber) {
                    const whatsappResult = await sendWhatsAppMessage(student.whatsappNumber, message, student);
                    communicationResults.push({
                        studentId: student.userId,
                        method: "WHATSAPP",
                        status: whatsappResult.success ? "SENT" : "FAILED",
                        error: whatsappResult.error
                    });
                }
                else {
                    communicationResults.push({
                        studentId: student.userId,
                        method: "WHATSAPP",
                        status: "FAILED",
                        error: "No WhatsApp number found"
                    });
                }
            }
        }
        res.json({
            success: true,
            message: "Bulk message sent successfully",
            communicationResults,
            metadata: {
                totalStudents: students.length,
                communicationMethod,
                subject,
                sentAt: new Date(),
                scheduledAt
            }
        });
    }
    catch (err) {
        next(err);
    }
}
// Send Individual Result
export async function sendIndividualResult(req, res, next) {
    try {
        const { examId, studentId } = req.params;
        const { communicationMethod, message, includeAnswers } = req.body;
        const exam = await Exam.findById(examId)
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section');
        if (!exam)
            throw new createHttpError.NotFound("Exam not found");
        const result = await Result.findOne({ examId, studentId })
            .populate('studentId', 'name email')
            .populate('answers.questionId');
        if (!result)
            throw new createHttpError.NotFound("Result not found");
        const student = await Student.findOne({ userId: studentId })
            .populate('classId', 'name displayName level section');
        if (!student)
            throw new createHttpError.NotFound("Student not found");
        // Prepare result data
        const resultData = {
            student: {
                name: result.studentId.name,
                rollNumber: student.rollNumber,
                class: student.classId
            },
            exam: {
                title: exam.title,
                examType: exam.examType,
                subject: exam.subjectId,
                class: exam.classId,
                totalMarks: exam.totalMarks,
                scheduledDate: exam.scheduledDate
            },
            result: {
                totalMarksObtained: result.totalMarksObtained,
                percentage: result.percentage,
                grade: result.grade,
                submissionStatus: result.submissionStatus,
                submittedAt: result.submittedAt,
                isAbsent: result.isAbsent,
                isMissingSheet: result.isMissingSheet,
                answers: includeAnswers ? result.answers.map(answer => ({
                    question: answer.questionId.questionText,
                    answer: answer.answer,
                    isCorrect: answer.isCorrect,
                    marksObtained: answer.marksObtained
                })) : undefined
            }
        };
        const communicationResults = [];
        // Send via email
        if (communicationMethod === "EMAIL" || communicationMethod === "BOTH") {
            if (student.parentsEmail) {
                const emailResult = await sendEmailResult(student.parentsEmail, resultData, message);
                communicationResults.push({
                    method: "EMAIL",
                    status: emailResult.success ? "SENT" : "FAILED",
                    error: emailResult.error
                });
            }
            else {
                communicationResults.push({
                    method: "EMAIL",
                    status: "FAILED",
                    error: "No parent email found"
                });
            }
        }
        // Send via WhatsApp
        if (communicationMethod === "WHATSAPP" || communicationMethod === "BOTH") {
            if (student.whatsappNumber) {
                const whatsappResult = await sendWhatsAppResult(student.whatsappNumber, resultData, message);
                communicationResults.push({
                    method: "WHATSAPP",
                    status: whatsappResult.success ? "SENT" : "FAILED",
                    error: whatsappResult.error
                });
            }
            else {
                communicationResults.push({
                    method: "WHATSAPP",
                    status: "FAILED",
                    error: "No WhatsApp number found"
                });
            }
        }
        res.json({
            success: true,
            message: "Individual result sent successfully",
            communicationResults,
            metadata: {
                examId,
                studentId,
                communicationMethod,
                sentAt: new Date()
            }
        });
    }
    catch (err) {
        next(err);
    }
}
// Mock email sending function
async function sendEmailResult(email, resultData, customMessage) {
    try {
        // Mock email sending - replace with actual email service
        const message = customMessage || generateResultEmailMessage(resultData);
        console.log(`Sending email to ${email}:`, message);
        // Simulate email sending
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
// Mock WhatsApp sending function
async function sendWhatsAppResult(phoneNumber, resultData, customMessage) {
    try {
        // Mock WhatsApp sending - replace with actual WhatsApp API
        const message = customMessage || generateResultWhatsAppMessage(resultData);
        console.log(`Sending WhatsApp to ${phoneNumber}:`, message);
        // Simulate WhatsApp sending
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
// Mock email message sending function
async function sendEmailMessage(email, subject, message, student) {
    try {
        // Mock email sending - replace with actual email service
        console.log(`Sending email to ${email} - Subject: ${subject}`, message);
        // Simulate email sending
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
// Mock WhatsApp message sending function
async function sendWhatsAppMessage(phoneNumber, message, student) {
    try {
        // Mock WhatsApp sending - replace with actual WhatsApp API
        console.log(`Sending WhatsApp to ${phoneNumber}:`, message);
        // Simulate WhatsApp sending
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
// Generate result email message
function generateResultEmailMessage(resultData) {
    return `
Dear Parent/Guardian,

Your child ${resultData.student.name} (Roll No: ${resultData.student.rollNumber}) has completed the ${resultData.exam.title} exam.

Exam Details:
- Subject: ${resultData.exam.subject.name}
- Class: ${resultData.exam.class.displayName}
- Total Marks: ${resultData.exam.totalMarks}
- Date: ${resultData.exam.scheduledDate}

Result:
- Marks Obtained: ${resultData.result.totalMarksObtained}/${resultData.exam.totalMarks}
- Percentage: ${resultData.result.percentage}%
- Grade: ${resultData.result.grade || 'N/A'}
- Status: ${resultData.result.submissionStatus}

${resultData.result.isAbsent ? 'Note: Student was absent for this exam.' : ''}
${resultData.result.isMissingSheet ? 'Note: Answer sheet is missing.' : ''}

Thank you for your continued support.

Best regards,
School Administration
  `.trim();
}
// Generate result WhatsApp message
function generateResultWhatsAppMessage(resultData) {
    return `
*Exam Result - ${resultData.exam.title}*

Student: ${resultData.student.name}
Roll No: ${resultData.student.rollNumber}
Class: ${resultData.exam.class.displayName}

*Result:*
📊 Marks: ${resultData.result.totalMarksObtained}/${resultData.exam.totalMarks}
📈 Percentage: ${resultData.result.percentage}%
🏆 Grade: ${resultData.result.grade || 'N/A'}

${resultData.result.isAbsent ? '⚠️ Student was absent' : ''}
${resultData.result.isMissingSheet ? '⚠️ Answer sheet missing' : ''}

Thank you for your support!
  `.trim();
}
//# sourceMappingURL=communicationController.js.map