using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ExtractorEpubBackend
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Extractor.epub Backend");
            Console.WriteLine("(C)2015 cyanic");
            Console.WriteLine();

            try
            {
                ExtractorServer server = new ExtractorServer();
                string path = server.Run();

                if (path != null)
                {
                    Console.WriteLine("Stripping stuff added by Bookshelf...");
                    JunkStripper.StripEpub(path);

                    Console.WriteLine("Packing...");
                    EpubConverter.Convert(path, System.IO.Path.ChangeExtension(path, ".epub"));

                    Console.WriteLine("Done!");
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error processing: " + ex.Message);
            }

            Console.WriteLine("Press any key to exit.");
            Console.ReadKey();
        }
    }
}
