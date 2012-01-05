opacmo
======

![opacmo logo](https://github.com/joejimbo/opacmo/raw/master/html/images/opacmo160.png)

opacmo is the Open Access Mortar — a mash-up of biomedical objects linked to the open-access subset of PubMed Central.

Requires Yoctogi backend.

Installation
============

opacmo requires Yoctogi as backend and uses bioknack's `bk_ner_gn.sh` to create the text mining resources.

PostgreSQL
----------

Install PostgreSQL 8.3 or newer, then -- on a Debian distro -- do

    sudo su - postgres
    createuser yoctogi
    Shall the new role be a superuser? (y/n) n
    Shall the new role be allowed to create databases? (y/n) n
    Shall the new role be allowed to create more new roles? (y/n) n
    createdb yoctogi
    load_opacmo.sh
    psql yoctogi
    ALTER USER yoctogi WITH PASSWORD 'yoctogi';
    GRANT SELECT ON yoctogi TO yoctogi;
    ^D


The `load_opacmo.sh` command expects the Yoctogi TSV files that have been generated in the directory `./opacmo_data`.


lighttpd
--------

Install and set up lighttpd. opacmo uses Yoctogi as backend, which requires FastCGI support.

    sudo apt-get install libfcgi-dev
    sudo gem install ruby-fcgi

Debian 5.0
----------

On Debian 5.0 you have to cheat a little bit to get the FastCGI going.

    cd /usr/include
    sudo ln -s ruby-1.9.0 ruby-1.9.1

Acknowledgements
----------------

Contributors in alphabetical order:

* Kenneth Chu. *Beta Testing.*
* Miyuki Fukuma. *Web-Design Consulting & CSS Coding.*

Licenses
--------

opacmo's source code is licensed under the [MIT License](https://raw.github.com/joejimbo/opacmo/master/LICENSE). opacmo's art work is licensed under the Creative Commons [Attribution-NonCommercial-NoDerivs 3.0](http://creativecommons.org/licenses/by-nc-nd/3.0/) license.

The PNG-files in

* `html/images/blue`
* `html/images/cyan`
* `html/images/grey_light`
* `html/images/red`

are part of the [Iconic](http://somerandomdude.com/projects/iconic/) minimal set of icons by
P.J. Onori. These icons are licenced under the
Creative Commons [Attribution-ShareAlike 3.0 United States](http://creativecommons.org/licenses/by-sa/3.0/us/)
license.

The spinner image `html/images/ajax-loader.gif` was created by [ajaxload.info](http://www.ajaxload.info/).
