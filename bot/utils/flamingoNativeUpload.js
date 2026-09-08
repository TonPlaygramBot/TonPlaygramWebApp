import Busboy from 'busboy';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

// Stage exactly one native File without buffering its body in application RAM.
// A rejected/interrupted body never replaces the session's acknowledged bytes.
export function receiveNativeWallFile(
  req,
  destination,
  { size, name, normalizeName }
) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        defParamCharset: 'utf8',
        limits: { fileSize: size + 1, files: 1, fields: 0, parts: 2 }
      });
    } catch {
      return reject(
        Object.assign(new Error('Select one video file to upload.'), {
          status: 400
        })
      );
    }
    let seen = false;
    let settled = false;
    let bytes = 0;
    let writing;
    let input;
    let output;
    const clean = () => {
      req.off('aborted', aborted);
      req.unpipe(parser);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clean();
      input?.destroy();
      output?.destroy();
      parser.destroy();
      req.resume();
      Promise.resolve(writing)
        .catch(() => {})
        .then(() => reject(error));
    };
    const invalid = (message, status = 400) =>
      Object.assign(new Error(message), { status });
    const aborted = () =>
      fail(invalid('The video upload was interrupted. Resume to retry.'));
    parser.on('error', fail);
    parser.on('filesLimit', () => fail(invalid('Upload one file at a time.')));
    parser.on('fieldsLimit', () =>
      fail(invalid('Upload settings belong to the existing session.'))
    );
    parser.on('partsLimit', () => fail(invalid('Upload one file at a time.')));
    parser.on('file', (field, stream, info) => {
      // Busboy can error the file stream while rejecting its headers, before
      // pipeline is installed. Observe it even for a wrong filename/field.
      input = stream;
      stream.on('error', fail);
      if (seen || field !== 'file' || normalizeName(info.filename) !== name) {
        stream.resume();
        return fail(
          invalid('This file does not match the selected upload.', 409)
        );
      }
      seen = true;
      output = createWriteStream(destination, { flags: 'r+', start: 0 });
      stream.on('limit', () =>
        fail(invalid('The video exceeds the selected file size.', 413))
      );
      writing = pipeline(
        stream,
        async function* (source) {
          for await (const chunk of source) {
            bytes += chunk.length;
            if (bytes > size)
              throw invalid('The video exceeds the selected file size.', 413);
            yield chunk;
          }
        },
        output
      );
      writing.catch(fail);
    });
    parser.on('close', async () => {
      try {
        await writing;
        if (settled) return;
        if (!seen || bytes !== size)
          return fail(
            invalid('The full video was not received. Resume to retry.', 409)
          );
        settled = true;
        clean();
        resolve(bytes);
      } catch (error) {
        fail(error);
      }
    });
    req.on('aborted', aborted);
    req.on('error', fail);
    // An IncomingMessage emits ECONNRESET after 'aborted'. Keep its error
    // observer until 'close' even when the upload promise has already rejected.
    req.once('close', () => req.off('error', fail));
    if (req.aborted) return aborted();
    req.pipe(parser);
  });
}
