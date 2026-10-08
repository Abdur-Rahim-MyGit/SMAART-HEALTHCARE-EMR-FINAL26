'use strict';
const { validateFile, parseDataUrl } = require('../../src/modules/documents/documentService');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7369b7e0000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

describe('upload validation', () => {
  it('accepts files whose magic bytes match their extension', async () => {
    expect((await validateFile({ buffer: PNG, fileName: 'x.png', claimedMime: 'image/png' })).mime).toBe('image/png');
    expect((await validateFile({ buffer: PDF, fileName: 'r.pdf', claimedMime: 'application/pdf' })).mime).toBe('application/pdf');
  });
  it('rejects mismatched extensions, disguised executables and unsupported types', async () => {
    await expect(validateFile({ buffer: PNG, fileName: 'x.pdf', claimedMime: 'application/pdf' })).rejects.toMatchObject({ code: 'EXTENSION_MISMATCH' });
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);
    await expect(validateFile({ buffer: exe, fileName: 'x.png', claimedMime: 'image/png' })).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    await expect(validateFile({ buffer: html, fileName: 'x.html', claimedMime: 'text/html' })).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
    await expect(validateFile({ buffer: Buffer.alloc(0), fileName: 'x.png' })).rejects.toMatchObject({ code: 'EMPTY_FILE' });
  });
  it('parses data URLs', () => {
    const p = parseDataUrl(`data:image/png;base64,${PNG.toString('base64')}`);
    expect(p.mime).toBe('image/png');
    expect(p.buffer.equals(PNG)).toBe(true);
    expect(parseDataUrl('https://example.com/x.png')).toBeNull();
  });
});
