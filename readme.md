Extractor.epub for VitalSource Bookshelf
========================================

This frontend/backend combination allows you to convert books in VitalBook EPUBBook format into regular EPUB books.
By sideloading Extractor.epub, the content of other EPUBBooks loaded in Bookshelf can be uploaded to the backend
and be packaged into a regular EPUB file which you can then use on other ebook readers.

Usage
-----
* Sideload Extractor.epub into Bookshelf. See [here](https://support.vitalsource.com/hc/en-us/articles/203256896-Side-load-EPUB-files-to-Bookshelf-for-Mac-PC) for instructions.
* Some adjustments must be made to Internet Explorer's security settings for this to work.
  * Open up Internet Options from Control Panel or Internet Explorer.
  * On the 'Security' tab, click 'Trusted sites', then the 'Sites' button.
  * Uncheck 'Require server verification (https:) for all sites in this zone'.
  * Type 'http://*.e.pub' into the text box, and click 'Add'. Then click 'Close'.
  * Click 'OK'.
* Run the backend (ExtractorEpubBackend.exe), and open the Extractor.epub in Bookshelf.
* Open the book you want to extract. This is important, otherwise the extractor won't be able to access the book's files. You can close it once you opened it once in the session.
* You need to know the file name of the book you're trying to extract. It is typically the VBID with '.vbk' appended
  when you view the book's information (right click on the book and select 'Show Book Information...'). For the exact
  name, look in the folder where Bookshelf has downloaded all your books (typically in C:\Users\Public\Documents\Shared Books\VitalSource Bookshelf\VitalBook Library).
* Enter the name into the 'File name' box on Extractor.epub. Then click 'Extract'.
* The book will be placed in the same directory as the backend's EXE file.
* If you don't see a converted .epub file, check both the frontend and the backend for error messages.

For Vista users
---------------
You may have trouble because Extractor.epub may use some features that are not available in Internet Explorer 9.
You may try to switch rendering engines to use Awesomium instead, which does support the needed features.
To do so, launch Bookshelf in debug mode (use '-d' as the command line argument), and from the 'View' menu select
'View Debug Options...'. Under 'EPUB Browser Option', choose 'Webkit'. Click OK. Follow the usage instructions as
normal. Note you may see an error about META-INF files after the status has turned to 'Done'. You can ignore that error.
  