using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Net;
using System.IO;
using System.Web;

namespace ExtractorEpubBackend
{
    class ExtractorServer
    {
        HttpListener server;
        bool running;
        string baseName;

        public ExtractorServer()
        {
            server = new HttpListener();
            server.Prefixes.Add("http://127.0.0.1:9080/");
            server.Prefixes.Add("http://localhost:9080/");
        }

        public string Run()
        {
            string completionString = null;
            running = true;
            server.Start();

            Console.WriteLine("Extractor.epub backend running");

            while (running)
            {
                HttpListenerContext context = server.GetContext();
                var queryString = context.Request.QueryString;

                if (context.Request.HttpMethod == "OPTIONS")
                {
                    context.Response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-With");
                    context.Response.AddHeader("Access-Control-Allow-Methods", "GET, POST");
                    context.Response.AddHeader("Access-Control-Max-Age", "1728000");
                }
                context.Response.AppendHeader("Access-Control-Allow-Origin", "*"); 
                
                if (context.Request.HttpMethod == WebRequestMethods.Http.Get || context.Request.HttpMethod == WebRequestMethods.Http.Post)
                switch (context.Request.Url.AbsolutePath)
                {
                    case "/startsession":
                        {
                            if (baseName != null)
                            {
                                context.Response.StatusCode = 400;
                                Console.WriteLine("Invalid start session request: trying to start new session when existing session has not ended");
                            }
                            else
                            {
                                string fileName = queryString["name"];
                                if (fileName == null)
                                {
                                    context.Response.StatusCode = 400;
                                    Console.WriteLine("Invalid start session request: no file name");
                                }
                                else
                                {
                                    this.baseName = fileName;
                                    try
                                    {
                                        Directory.CreateDirectory(baseName);
                                        Console.WriteLine("Session started for " + baseName);
                                    }
                                    catch (Exception ex)
                                    {
                                        Console.WriteLine("Failed to create book directory: " + ex.Message);
                                        context.Response.StatusCode = 500;
                                        Stop();
                                    }
                                }
                            }
                        }
                        break;
                    case "/upload":
                        {
                            string fileName = queryString["path"];
                            if (fileName == null)
                            {
                                context.Response.StatusCode = 400;
                                Console.WriteLine("Invalid upload request: no file name");
                                Stop();
                                break;
                            }

                            fileName = fileName.TrimStart('/');
                            if (!Path.GetFullPath(fileName).StartsWith(Path.GetFullPath(baseName)))
                            {
                                context.Response.StatusCode = 400;
                                Console.WriteLine("Invalid upload request: wrong session or attempting to write to directories above current");
                            }
                            else
                            {
                                Console.WriteLine("Downloading " + fileName);
                                try
                                {
                                    Directory.CreateDirectory(Path.GetDirectoryName(fileName));
                                    using (FileStream fs = File.Create(fileName))
                                    {
                                        context.Request.InputStream.CopyTo(fs);
                                        fs.Flush();
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine("Failed to download file: " + ex.Message);
                                    context.Response.StatusCode = 500;
                                    Stop();
                                }
                            }
                        }
                        break;
                    case "/endsession":
                        {
                            string fileName = queryString["name"];
                            if (fileName == null)
                            {
                                context.Response.StatusCode = 400;
                                Console.WriteLine("Invalid end session request: no session name");
                            }
                            else if (fileName != baseName)
                            {
                                context.Response.StatusCode = 400;
                                Console.WriteLine("Invalid end session request: wrong session");
                            }
                            else
                            {
                                completionString = baseName;
                                baseName = null;
                                Console.WriteLine("Session finished, stopping.");
                                Stop();
                            }
                        }
                        break;
                    case "/fail":
                        {
                            string fileName = queryString["name"];
                            if (fileName == null)
                            {
                                context.Response.StatusCode = 400;
                                Console.WriteLine("Invalid fail request: no session name");
                            }

                            if (fileName == baseName)
                            {
                                Console.WriteLine("Extractor failed, stopping.");
                                Stop();
                            }
                        }
                        break;
                    default:
                        context.Response.StatusCode = 400;
                        Console.WriteLine("Invalid request received.");
                        break;
                }
                context.Response.Close();
            }

            server.Stop();
            return completionString;
        }

        public void Stop()
        {
            running = false;
        }
    }
}
