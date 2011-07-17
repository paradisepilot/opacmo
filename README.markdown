opacmo
======

![opacmo logo](https://github.com/joejimbo/opacmo/raw/master/html/images/opacmo160.png)

An interactive web-interface for accessing biomedical literature data.

Requires Yoctogi backend.

PostgreSQL
----------

sudo su - postgres

createuser yoctogi
Shall the new role be a superuser? (y/n) n
Shall the new role be allowed to create databases? (y/n) n
Shall the new role be allowed to create more new roles? (y/n) n

createdb yoctogi

psql yoctogi

CREATE TABLE yoctogi (pmcid VARCHAR(24), title TEXT, entrezid VARCHAR(24), gene VARCHAR(512), genescore INTEGER, taxid VARCHAR(24), species VARCHAR(128), doid VARCHAR(24), disease VARCHAR(512), diseasescore INTEGER, goid VARCHAR(24), goterm VARCHAR(512), gotermscore INTEGER);
CREATE INDEX pmcid_idx ON yoctogi (pmcid);
CREATE INDEX entrezid_idx ON yoctogi (entrezid);
CREATE INDEX gene_idx ON yoctogi (gene);
CREATE INDEX genescore_idx ON yoctogi (genescore);
CREATE INDEX taxid_idx ON yoctogi (taxid);
CREATE INDEX species_idx ON yoctogi (species);
CREATE INDEX doid_idx ON yoctogi (doid);
CREATE INDEX disease_idx ON yoctogi (disease);
CREATE INDEX diseasescore_idx ON yoctogi (diseasescore);
CREATE INDEX goid_idx ON yoctogi (goid);
CREATE INDEX goterm_idx ON yoctogi (goterm);
CREATE INDEX gotermscore ON yoctogi (gotermscore);

ALTER USER yoctogi WITH PASSWORD 'yoctogi';
GRANT SELECT ON yoctogi TO yoctogi;

lighttpd
--------

sudo apt-get install libfcgi-dev
sudo gem install ruby-fcgi

Debian 5.0
----------

cd /usr/include
sudo ln -s ruby-1.9.0 ruby-1.9.1

Licenses
--------

opacmo is licensed under the MIT License (see LICENSE file).

The PNG-files in

* `html/images/blue`
* `html/images/cyan`
* `html/images/grey_light`

are part of the [Iconic](http://somerandomdude.com/projects/iconic/) minimal set of icons by
P.J. Onori. These icons are licenced under the
[Attribution-ShareAlike 3.0 United States](http://creativecommons.org/licenses/by-sa/3.0/us/)
Creative Commons License.

The spinner image `html/images/ajax-loader.gif` was created by [ajaxload.info](http://www.ajaxload.info/).
