import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ImageProcessingService } from '../../src/services/imageProcessing';
import sharp from 'sharp';
// Mock sharp
jest.mock('sharp');
describe('ImageProcessingService', () => {
    let mockSharp;
    beforeEach(() => {
        jest.clearAllMocks();
        mockSharp = sharp;
    });
    describe('processAnswerSheet', () => {
        it('should process a valid image successfully', async () => {
            const mockBuffer = Buffer.from('mock-image-data');
            const mockMetadata = {
                width: 1200,
                height: 1600,
                density: 300,
                format: 'jpeg'
            };
            const mockSharpInstance = {
                metadata: jest.fn().mockResolvedValue(mockMetadata),
                greyscale: jest.fn().mockReturnThis(),
                raw: jest.fn().mockReturnThis(),
                toBuffer: jest.fn().mockResolvedValue(mockBuffer),
                stats: jest.fn().mockResolvedValue({
                    channels: [{ stdev: 45 }]
                }),
                rotate: jest.fn().mockReturnThis(),
                jpeg: jest.fn().mockReturnThis(),
                extract: jest.fn().mockReturnThis(),
                normalize: jest.fn().mockReturnThis(),
                convolve: jest.fn().mockReturnThis()
            };
            mockSharp.mockReturnValue(mockSharpInstance);
            const result = await ImageProcessingService.processAnswerSheet(mockBuffer, 'test.jpg');
            expect(result).toBeDefined();
            expect(result.scanQuality).toBe('GOOD');
            expect(result.isAligned).toBe(true);
            expect(result.rollNumberConfidence).toBeGreaterThanOrEqual(0);
        });
        it('should handle low quality images', async () => {
            const mockBuffer = Buffer.from('mock-image-data');
            const mockMetadata = {
                width: 400,
                height: 600,
                density: 72,
                format: 'jpeg'
            };
            const mockSharpInstance = {
                metadata: jest.fn().mockResolvedValue(mockMetadata),
                greyscale: jest.fn().mockReturnThis(),
                raw: jest.fn().mockReturnThis(),
                toBuffer: jest.fn().mockResolvedValue(mockBuffer),
                stats: jest.fn().mockResolvedValue({
                    channels: [{ stdev: 5 }]
                }),
                rotate: jest.fn().mockReturnThis(),
                jpeg: jest.fn().mockReturnThis(),
                extract: jest.fn().mockReturnThis(),
                normalize: jest.fn().mockReturnThis(),
                convolve: jest.fn().mockReturnThis()
            };
            mockSharp.mockReturnValue(mockSharpInstance);
            const result = await ImageProcessingService.processAnswerSheet(mockBuffer, 'test.jpg');
            expect(result.scanQuality).toBe('UNREADABLE');
            expect(result.issues).toContain('Image resolution too low');
            expect(result.issues).toContain('Low DPI - scan at higher resolution');
        });
        it('should detect and correct rotation', async () => {
            const mockBuffer = Buffer.from('mock-image-data');
            const mockMetadata = {
                width: 1200,
                height: 1600,
                density: 300,
                format: 'jpeg'
            };
            const mockSharpInstance = {
                metadata: jest.fn().mockResolvedValue(mockMetadata),
                greyscale: jest.fn().mockReturnThis(),
                raw: jest.fn().mockReturnThis(),
                toBuffer: jest.fn().mockResolvedValue(mockBuffer),
                stats: jest.fn().mockResolvedValue({
                    channels: [{ stdev: 45 }]
                }),
                rotate: jest.fn().mockReturnThis(),
                jpeg: jest.fn().mockReturnThis(),
                extract: jest.fn().mockReturnThis(),
                normalize: jest.fn().mockReturnThis(),
                convolve: jest.fn().mockReturnThis()
            };
            mockSharp.mockReturnValue(mockSharpInstance);
            const result = await ImageProcessingService.processAnswerSheet(mockBuffer, 'test.jpg');
            expect(result.isAligned).toBe(true);
            expect(result.rotationAngle).toBe(0);
        });
        it('should handle processing errors gracefully', async () => {
            const mockBuffer = Buffer.from('invalid-data');
            mockSharp.mockImplementation(() => {
                throw new Error('Invalid image data');
            });
            await expect(ImageProcessingService.processAnswerSheet(mockBuffer, 'test.jpg')).rejects.toThrow('Image processing failed: Invalid image data');
        });
    });
    describe('processBatch', () => {
        it('should process multiple images', async () => {
            const images = [
                { buffer: Buffer.from('image1'), filename: 'test1.jpg' },
                { buffer: Buffer.from('image2'), filename: 'test2.jpg' }
            ];
            const mockMetadata = {
                width: 1200,
                height: 1600,
                density: 300,
                format: 'jpeg'
            };
            const mockSharpInstance = {
                metadata: jest.fn().mockResolvedValue(mockMetadata),
                greyscale: jest.fn().mockReturnThis(),
                raw: jest.fn().mockReturnThis(),
                toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed')),
                stats: jest.fn().mockResolvedValue({
                    channels: [{ stdev: 45 }]
                }),
                rotate: jest.fn().mockReturnThis(),
                jpeg: jest.fn().mockReturnThis(),
                extract: jest.fn().mockReturnThis(),
                normalize: jest.fn().mockReturnThis(),
                convolve: jest.fn().mockReturnThis()
            };
            mockSharp.mockReturnValue(mockSharpInstance);
            const results = await ImageProcessingService.processBatch(images);
            expect(results).toHaveLength(2);
            expect(results[0].scanQuality).toBe('GOOD');
            expect(results[1].scanQuality).toBe('GOOD');
        });
        it('should handle mixed success and failure in batch processing', async () => {
            const images = [
                { buffer: Buffer.from('valid-image'), filename: 'test1.jpg' },
                { buffer: Buffer.from('invalid-image'), filename: 'test2.jpg' }
            ];
            const mockMetadata = {
                width: 1200,
                height: 1600,
                density: 300,
                format: 'jpeg'
            };
            const mockSharpInstance = {
                metadata: jest.fn().mockResolvedValue(mockMetadata),
                greyscale: jest.fn().mockReturnThis(),
                raw: jest.fn().mockReturnThis(),
                toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed')),
                stats: jest.fn().mockResolvedValue({
                    channels: [{ stdev: 45 }]
                }),
                rotate: jest.fn().mockReturnThis(),
                jpeg: jest.fn().mockReturnThis(),
                extract: jest.fn().mockReturnThis(),
                normalize: jest.fn().mockReturnThis(),
                convolve: jest.fn().mockReturnThis()
            };
            mockSharp.mockReturnValue(mockSharpInstance);
            // Mock one image to fail
            mockSharp.mockImplementationOnce(() => mockSharpInstance);
            mockSharp.mockImplementationOnce(() => {
                throw new Error('Processing failed');
            });
            const results = await ImageProcessingService.processBatch(images);
            expect(results).toHaveLength(2);
            expect(results[0].scanQuality).toBe('GOOD');
            expect(results[1].scanQuality).toBe('UNREADABLE');
            expect(results[1].issues).toContain('Processing failed: Processing failed');
        });
    });
});
//# sourceMappingURL=imageProcessing.test.js.map