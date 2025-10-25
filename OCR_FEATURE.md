# OCR Feature Documentation

## Overview

The file converter now includes advanced OCR (Optical Character Recognition) capabilities powered by DeepSeek OCR and Tesseract.js. This feature allows you to extract text from images and scanned PDFs with high accuracy.

## Features

### 1. Multi-Engine Support
- **DeepSeek OCR API** (Optional): Premium OCR with superior accuracy and multi-language support
- **Tesseract.js** (Default): Free, browser-based OCR that works offline

### 2. Image Pre-Processing
Automatically enhances images before OCR for better results:
- **Contrast Enhancement**: Improves text visibility
- **Grayscale Conversion**: Optimizes for text recognition
- **Sharpening Filter**: Enhances edge detection

### 3. Text Post-Processing
Cleans up extracted text:
- Removes excessive whitespace
- Fixes common OCR errors (0→O, 1→l, etc.)
- Normalizes line breaks
- Trims and formats output

### 4. Multi-Language Support
- Auto-detection of language
- Support for 100+ languages
- Configurable language preferences

## Supported Conversions

### Image to Text
- **JPG/JPEG → TXT**: Extract text from photos and scanned documents
- **PNG → TXT**: Extract text from screenshots and graphics
- **WEBP → TXT**: Extract text from modern web images

### PDF to Text (OCR)
- Automatically detects if PDF has embedded text
- Falls back to OCR for scanned PDFs
- Processes up to 10 pages for performance

## Usage

### Basic Usage
1. Upload an image (JPG, PNG, WEBP)
2. Select "TXT" as the target format
3. Click "Convert"
4. Download the extracted text file

### With DeepSeek API (Optional)
For enhanced accuracy and speed:

1. Get your API key from [DeepSeek](https://platform.deepseek.com)
2. Go to Settings in the app
3. Enter your DeepSeek API key
4. OCR will automatically use DeepSeek when available

### Configuration Options

The OCR service supports the following options:

\`\`\`typescript
{
  enhanceImage: true,      // Apply pre-processing
  language: 'auto',        // Language detection
  preserveLayout: true     // Maintain document structure
}
\`\`\`

## Technical Details

### Image Pre-Processing Pipeline
1. **Load Image**: Convert blob to canvas
2. **Contrast Enhancement**: Apply contrast factor of 1.2
3. **Grayscale Conversion**: Use luminosity method (0.299R + 0.587G + 0.114B)
4. **Sharpening**: Apply 3x3 convolution kernel
5. **Export**: Convert to PNG at 95% quality

### Text Post-Processing Pipeline
1. **Whitespace Normalization**: Collapse multiple spaces
2. **OCR Error Correction**: Fix common character misrecognitions
3. **Line Break Normalization**: Limit to 2 consecutive breaks
4. **Trimming**: Remove leading/trailing whitespace

### Fallback Strategy
\`\`\`
DeepSeek API (if key available)
    ↓ (on error)
Tesseract.js (browser-based)
    ↓ (on error)
Error message to user
\`\`\`

## Performance

### Speed
- **Tesseract.js**: 2-5 seconds per image (browser-based)
- **DeepSeek API**: 1-2 seconds per image (server-based)

### Accuracy
- **Tesseract.js**: 85-95% accuracy on clear text
- **DeepSeek API**: 95-99% accuracy with advanced features

### Limitations
- PDF OCR limited to 10 pages for performance
- Large images may take longer to process
- Handwritten text has lower accuracy

## Privacy

### Tesseract.js (Default)
- **100% Private**: All processing happens in your browser
- **No Data Sent**: Files never leave your device
- **Offline Capable**: Works without internet connection

### DeepSeek API (Optional)
- **API-Based**: Images sent to DeepSeek servers
- **Temporary Storage**: Files deleted after processing
- **Encrypted Transfer**: HTTPS encryption
- **User Control**: Only used if API key is provided

## Troubleshooting

### Low Accuracy
- Enable image enhancement in settings
- Ensure image has good contrast
- Try higher resolution images
- Check if text is clearly visible

### Slow Performance
- Reduce image size before conversion
- Use DeepSeek API for faster processing
- Process fewer pages for PDFs

### API Errors
- Verify API key is correct
- Check API quota/limits
- System will fallback to Tesseract.js automatically

## Future Enhancements

- [ ] Batch processing for multiple images
- [ ] Custom OCR training for specific fonts
- [ ] Table and form recognition
- [ ] Handwriting recognition
- [ ] Real-time OCR preview
- [ ] Export to multiple formats (DOCX, PDF)

## Resources

- [DeepSeek OCR GitHub](https://github.com/deepseek-ai/DeepSeek-OCR)
- [DeepSeek API Documentation](https://platform.deepseek.com/docs)
- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
