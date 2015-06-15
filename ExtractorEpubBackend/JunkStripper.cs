using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using System.IO;
using System.Xml;

namespace ExtractorEpubBackend
{
    static class JunkStripper
    {
        static readonly string Pattern1 = @"<script type='text\/javascript'> if.+?<\/script>";
        static readonly string Pattern2 = @"<script src='http:\/\/e.pub\/.+?<\/script>";
        static readonly string Pattern3 = @"<script type='text\/javascript'> window.console =.+?<\/script>";
        static readonly string Pattern4 = @"<script>var VST.+?<\/script>";

        public static void StripFile(string path)
        {
            string text = File.ReadAllText(path, Encoding.UTF8);
            if (text[0] != '<') return; // Ignore files that don't appear to be HTML
            text = Regex.Replace(text, Pattern1, string.Empty, RegexOptions.Multiline);
            text = Regex.Replace(text, Pattern2, string.Empty, RegexOptions.Multiline);
            text = Regex.Replace(text, Pattern3, string.Empty, RegexOptions.Multiline);
            text = Regex.Replace(text, Pattern4, string.Empty, RegexOptions.Multiline);
            File.WriteAllText(path, text, Encoding.UTF8);
        }

        public static void StripEpub(string path)
        {
            XmlDocument container = new XmlDocument();
            container.Load(Path.Combine(path, "META-INF", "container.xml"));
            foreach (XmlNode e in container.DocumentElement["rootfiles"].ChildNodes)
            {
                if (!(e is XmlElement)) continue;
                XmlElement elem = e as XmlElement;
                string basePath = Path.Combine(path, Path.GetDirectoryName(elem.GetAttribute("full-path")));
                XmlDocument opf = new XmlDocument();
                opf.Load(Path.Combine(path, elem.GetAttribute("full-path")));

                foreach (XmlNode i in opf.DocumentElement["manifest"].ChildNodes)
                {
                    if (!(i is XmlElement)) continue;
                    XmlElement item = i as XmlElement;
                    string mime = item.GetAttribute("media-type");
                    if (mime == "text/html" || mime == "application/xhtml+xml")
                    {
                        StripFile(Path.Combine(basePath, item.GetAttribute("href")));
                    }
                }
            }
        }
    }
}
