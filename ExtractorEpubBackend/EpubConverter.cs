using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.IO.Compression;

namespace ExtractorEpubBackend
{
    static class EpubConverter
    {
        public static void Convert(string basePath, string outputPath)
        {
            using (ZipStorer zip = ZipStorer.Create(outputPath, string.Empty))
            {
                DateTime modDate = DateTime.Now;
                Console.WriteLine("Adding /mimetype");
                using (Stream mimetypeStream = File.OpenRead(Path.Combine(basePath, "mimetype")))
                {
                    WriteStreamToZip(zip, ZipStorer.Compression.Store, "mimetype", mimetypeStream, modDate, null);
                }

                foreach (string path in Directory.GetFiles(basePath, "*", SearchOption.AllDirectories))
                {
                    string strippedPath = path.Replace(basePath, "").Replace('\\', '/').TrimStart('/');
                    if (path == "/mimetype") continue;

                    Console.WriteLine("Adding " + strippedPath);
                    using (Stream fileStream = File.OpenRead(path))
                    {
                        WriteStreamToZip(zip, ZipStorer.Compression.Deflate, strippedPath, fileStream, modDate, null);
                    }
                }
            }
        }

        static void WriteStreamToZip(ZipStorer zip, ZipStorer.Compression compression, string name, Stream stream, DateTime modtime, string comment)
        {
            if (!stream.CanSeek)
            {
                // Load entire file to memory, because ZipStorer will try to access the Position property
                using (MemoryStream ms = new MemoryStream())
                {
                    stream.CopyTo(ms);
                    ms.Seek(0, SeekOrigin.Begin);
                    zip.AddStream(ZipStorer.Compression.Deflate, name, ms, modtime, comment);
                }
            }
            else
            {
                zip.AddStream(ZipStorer.Compression.Deflate, name, stream, modtime, comment);
            }
        }
    }
}
