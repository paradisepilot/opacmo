/*
 * opacmo -- The Open Access Mortar
 *
 * For copyright and license see LICENSE file.
 *
 * Contributors:
 *   - Joachim Baran
 */

var updateInProgress = false;

var opacmoBaseURI = '/opacmo/html';
var yoctogiBaseURI = 'http://localhost/yoctogi.fcgi';

var aboutSlider = null;
var aboutSwitch = new Element('div#aboutswitch', { 'class': 'headerbutton' } );
var releaseSlider = null;
var releaseSwitch = new Element('div#releaseswitch');
var helperSliders = {};
var noSuggestionsMessage = new Element('span', { 'class': 'notfound', 'html': 'No suggestions found.' });
var noResultsMessage = new Element('span', { 'class': 'notfound', 'html': 'No results found.' });

var browseMessage = new Element('span', { 'class': 'browsetext', 'html': '' });
var browseLeft = new Element('img', { 'class': 'browsebutton', 'src': opacmoBaseURI + '/images/gray_dark/arrow_left_12x12.png' });
var browseRight = new Element('img', { 'class': 'browsebutton', 'src': opacmoBaseURI + '/images/gray_dark/arrow_right_12x12.png' });
var browseOffset = 0;
var yoctogiSuggestionLimit = 5;
var yoctogiAggregateLimit = 25;

var sortedMessage = new Element('span', { 'class': 'sortedtext', 'html': '<br />Sorted by score of: ' });
var sortedByEntrez = new Element('a', { 'class': 'sortedbutton', 'html': 'Entrez Genes' });
var sortedBySpecies = new Element('a', { 'class': 'sortedbutton', 'html': 'Species' });
var sortedByGO = new Element('a', { 'class': 'sortedbutton', 'html': 'GO Terms' });
var sortedByDO = new Element('a', { 'class': 'sortedbutton', 'html': 'DO Terms' });
var sortedByChEBI = new Element('a', { 'class': 'sortedbutton', 'html': 'ChEBI Terms' });
var sortedSelected = 'entrezscore';

var queryOverText = null;
var suggestionSpinner = null;
var resultSpinner = null;
var springerSpinner = null;

var workaroundHtmlTable = null;
var workaroundHtmlTableRow = null;

var suggestionTableCounter = 0;
var suggestionTables = {};
var suggestionColumns = {};

var processQueryTimeOutID = 0;

var selectedEntities = {};

var opacmoStats = {};

var column2Header = {
		'titles':		'Title',
		'pmcid':		'PMC ID',
		'entrezname':		'Entrez Gene Name',
		'entrezid':		'Entrez Gene ID',
		'entrezscore':		'bioknack Score',
		'speciesname':		'NCBI Species Name',
		'speciesid':		'NCBI Species ID',
		'speciesscore':		'bioknack Score',
		'goname':		'Gene Ontology Term Name',
		'goid':			'Gene Ontology ID',
		'goscore':		'bioknack Score',
		'doname':		'Disease Ontology Term Name',
		'doid':			'Disease Ontology ID',
		'doscore':		'bioknack Score',
		'chebiname':		'ChEBI Term Name',
		'chebiid':		'ChEBI ID',
		'chebiscore':		'bioknack Score'
	};

var header2ResultHeader = {
		'PMC ID':				'PMC ID',
		'Entrez Gene Name':			'Entrez Genes:',
		'Entrez Gene ID':			'Entrez Genes:',
		'NCBI Species Name':			'NCBI Species:',
		'NCBI Species ID':			'NCBI Species:',
		'Gene Ontology Term Name':		'Gene Ontology Terms:',
		'Gene Ontology ID':			'Gene Ontology Terms:',
		'Disease Ontology Term Name':		'Disease Ontology Terms:',
		'Disease Ontology ID':			'Disease Ontology Terms:',
		'ChEBI Term Name':			'ChEBI Terms:',
		'ChEBI ID':				'ChEBI Terms:'
};

var type2Name = {
		'tsv':		'TSV',
		'xls':		'Excel',
		'galaxy':	'Galaxy'
};

var suggestionRequest = new Request.JSON({
		url: yoctogiBaseURI,
		link: 'cancel',
		onSuccess: function(response) {
			suggestionSpinner.hide();

			if (response.error) {
				// TODO
				alert(response['message']);
				return;
			}

			clearSuggestions();
			if (!response.result)
				return;

			var totalResults = 0;

			for (var result in response.result) {
				var partialResult = response.result[result]['result']

				totalResults += partialResult.length;

				if (partialResult.length == 0)
					continue;

				var id = makeTable($('suggestioncontainer'), partialResult, [column2Header[result]], false);

				suggestionColumns[id] = result;
			}

			if (!totalResults)
				noSuggestionsMessage.inject($('suggestioncontainer'));
		}
	});

var resultRequest = new Request.JSON({
		url: yoctogiBaseURI,
		link: 'cancel',
		onSuccess: function(response) {
			if (response.error) {
				resultSpinner.hide();

				// TODO
				alert(response['message']);
				return;
			}

			if ($('optionHelpMessages').checked)
				helperSliders['help2'].slideIn();

			if (response.download) {
				if (response.linkout) {
					Cookie.dispose('yoctogi_session');
					window.location = response.linkout;
				}

				var type = response.download.replace(/^[^.]+\./, '')
				var filename = response.download.replace(/^[^\/]+\//, '')
				var link = new Element('a#downloadfile' + type, {
					'class': 'downloadfile',
					'href': 'http://www.opacmo.org/' + response.download,
					'html': filename,
					'target': '_blank'
				});
				$('downloadlink').empty();
				link.inject($('downloadlink'));
				$('downloadtype').innerHTML = type2Name[type];
				$('downloaddialog').set('class', 'modal');

				return;
			}

			$('resultdownloads').empty();
			$('resultbrowse').empty();
			$('resultcontainer').empty();

			makeDownload('tsv', 'btn primary');
			makeDownload('xls', 'btn primary');
			if (Cookie.read('yoctogi_session'))
				makeDownload('galaxy', 'btn success');

			if (response.count > 0) {
				var pmcidsReturned = 0;
				browseMax = response.count;

				for (var pmcid in response.result)
					pmcidsReturned++;

				browseMessage.set('html', 'Showing results ' + (browseOffset + 1) + ' to ' + (browseOffset + pmcidsReturned) + ' of ' + browseMax + ' total');
				browseMessage.inject($('resultbrowse'));
				browseLeft.inject($('resultbrowse'));
				browseRight.inject($('resultbrowse'));

				sortedMessage.inject($('resultbrowse'));
				sortedByEntrez.inject($('resultbrowse'));
				sortedBySpecies.inject($('resultbrowse'));
				sortedByGO.inject($('resultbrowse'));
				sortedByDO.inject($('resultbrowse'));
				sortedByChEBI.inject($('resultbrowse'));

				updateSortedButtons();
			}

			// TODO If browseOffset > 0, then hide Springer container.

			var continuousNumber = browseOffset + 1;
			opacmoStats = { 'total': parseInt(response['count']), 'distribution': {}, 'dois': {} };

			for (var pmcid in response.result) {
				var pmcInfo = new Element('div#pmc' + pmcid, {
					'class': 'pmccontainer'
				});
				var pmcidElement = new Element('div#pmcid' + pmcid, {
					'class': 'pmcidcontainer'
				});
				var title = new Element('div#title' + pmcid, {
					'class': 'titlecontainer'
				});
				var journal = new Element('div#journal' + pmcid, {
					'class': 'journalcontainer'
				});
				var year = new Element('div#year' + pmcid, {
					'class': 'yearcontainer'
				});
				var doi = new Element('div#doi' + pmcid, {
					'class': 'doicontainer'
				});
				var genes = new Element('div#genes' + pmcid, {
					'class': 'genescontainer'
				});
				var species = new Element('div#species' + pmcid, {
					'class': 'speciescontainer'
				});
				var terms_go = new Element('div#termsgo' + pmcid, {
					'class': 'termscontainer'
				});
				var terms_do = new Element('div#termsdo' + pmcid, {
					'class': 'termscontainer'
				});
				var terms_chebi = new Element('div#termschebi' + pmcid, {
					'class': 'termscontainer'
				});
				for (var i in response.result[pmcid]) {
					var batch = response.result[pmcid][i];

					if (!batch.selection || batch.selection.length == 1)
						continue;

					// Collect statistics:
					if (opacmoStats['distribution'][batch.result[0][5]])
						opacmoStats['distribution'][batch.result[0][5]] = opacmoStats['distribution'][batch.result[0][5]] + 1;
					else
						opacmoStats['distribution'][batch.result[0][5]] = 1;
					opacmoStats['dois'][batch.result[0][2]] = true;

					makeDocumentView(continuousNumber++, pmcidElement, doi, title, journal, year, batch.result[0][0], batch.result[0][2], batch.result[0][3], batch.result[0][4], batch.result[0][5]);

					var aggregate = batch.result[0][6].length > 0 ? batch.result[0][6].split('#!#') : [];
					for (var row = 0; row < aggregate.length; row++) {
						var entity = aggregate[row].split('@!@');
						makeRow(header2ResultHeader['Entrez Gene Name'], 'resultlink', row, genes, entity[0], entity[1], entity[2], 'http://www.ncbi.nlm.nih.gov/gene/' + entity[1]);
					}

					aggregate = batch.result[0][7].length > 0 ? batch.result[0][7].split('#!#') : [];
					for (var row = 0; row < aggregate.length; row++) {
						var entity = aggregate[row].split('@!@');
						makeRow(header2ResultHeader['NCBI Species Name'], 'resultlink', row, species, entity[0], entity[1], entity[2], 'http://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + entity[1]);
					}

					aggregate = batch.result[0][8].length > 0 ? batch.result[0][8].split('#!#') : [];
					for (var row = 0; row < aggregate.length; row++) {
						var entity = aggregate[row].split('@!@');
						makeRow(header2ResultHeader['Gene Ontology Term Name'], 'resultlink', row, terms_go, entity[0], entity[1], entity[2], 'http://amigo.geneontology.org/cgi-bin/amigo/term_details?term=' + entity[1]);
					}

					aggregate = batch.result[0][9].length > 0 ? batch.result[0][9].split('#!#') : [];
					for (var row = 0; row < aggregate.length; row++) {
						var entity = aggregate[row].split('@!@');
						makeRow(header2ResultHeader['Disease Ontology Term Name'], 'resultlink', row, terms_do, entity[0], entity[1], entity[2], 'http://www.ebi.ac.uk/ontology-lookup/browse.do?ontName=DOID&termId=DOID%3A' + entity[1].replace(/^[^:]+:/, ''));
					}

					aggregate = batch.result[0][10].length > 0 ? batch.result[0][10].split('#!#') : [];
					for (var row = 0; row < aggregate.length; row++) {
						var entity = aggregate[row].split('@!@');
						makeRow(header2ResultHeader['ChEBI Term Name'], 'resultlink', row, terms_chebi, entity[0], entity[1], entity[2], 'http://www.ebi.ac.uk/chebi/searchId.do?chebiId=' + entity[1]);
					}
				}
				title.inject(pmcInfo);
				journal.inject(pmcInfo);
				year.inject(pmcInfo);
				pmcidElement.inject(pmcInfo);
				doi.inject(pmcInfo);
				genes.inject(pmcInfo);
				species.inject(pmcInfo);
				terms_go.inject(pmcInfo);
				terms_do.inject(pmcInfo);
				terms_chebi.inject(pmcInfo);
				pmcInfo.inject($('resultcontainer'));
			}

			resultSpinner.hide();

			if (response.count == 0) {
				noResultsMessage.inject($('resultcontainer'));
				$('resultspringer').empty();
			} else
				if ($('optionSpringer').checked) {
					$('resultspringer').empty();
					springerSpinner.show();
					springerRequest.send('SPRINGER=' + response.options['springerterms'].join('+'));
				}
		}
	});

var springerRequest = new Request.JSON({
		url: yoctogiBaseURI,
		method: 'get',
		link: 'cancel',
		onSuccess: function(response) {
			springerSpinner.hide();

			if (response.error) {
				// TODO
				alert(response['message']);
				return;
			}

			var total = response.result.result[0].total;

			// For counting documents that are both in the top-n of opacmo/Springer:
			var overlaps = 0;
			delete opacmoStats['dois'][''];

			var springerStats = { 'total': total, 'distribution': {} };

			new Element('span', { 'class': 'browsetext', 'html': 'Showing results 1 to ' + response.result.records.length + ' of ' + total + ' total' }).inject($('resultspringer'));

			for (var i = 0; i < response.result.records.length; i++) {
				var title = response.result.records[i].title;
				var url = response.result.records[i].url;
				var doi = response.result.records[i].doi;
				var date = response.result.records[i].publicationDate;
				var journal = response.result.records[i].publicationName;
				var year = date.substr(0, 4);

				var pmcInfo = new Element('div#springer' + i, {
					'class': 'pmccontainer'
				});
				var titleElement = new Element('div#springertitle' + i, {
					'class': 'titlecontainer'
				});
				var journalElement = new Element('div#springerjournal' + i, {
					'class': 'journalcontainer'
				});
				var yearElement = new Element('div#springeryear' + i, {
					'class': 'yearcontainer'
				});
				var doiElement = new Element('div#springerdoi' + i, {
					'class': 'doicontainer'
				});

				makeDocumentView(i + 1, null, doiElement, titleElement, journalElement, yearElement, url, doi, title, journal, year);

				titleElement.inject(pmcInfo);
				journalElement.inject(pmcInfo);
				yearElement.inject(pmcInfo);
				doiElement.inject(pmcInfo);
				pmcInfo.inject($('resultspringer'));

				if (springerStats['distribution'][year])
					springerStats['distribution'][year] = springerStats['distribution'][year] + 1;
				else
					springerStats['distribution'][year] = 1;
				if (opacmoStats['dois'][doi])
					overlaps++;
			}

			// Everything!
			new Element('div#totalChart', { 'style': 'text-align: center; margin-left: auto; margin-right: auto;' }).inject($('resultspringer'));
			var totalChart = new google.visualization.ColumnChart(document.getElementById('totalChart'));
			var totalStats = new google.visualization.DataTable();
			totalStats.addColumn('string', 'Source');
			totalStats.addColumn('number', 'Number of results');
			totalStats.addRow([ 'opacmo', parseInt(opacmoStats['total']) ]);
			totalStats.addRow([ 'Springer', parseInt(springerStats['total']) ]);
			totalChart.draw(totalStats, { 'width': 500, 'height': 600, 'fontName': 'Helvetica', 'fontSize': 12, 'backgroundColor': '#eeeeee', 'legend': { 'position': 'none' } });

			// Top-25 only!
			new Element('div#overlapChart', { 'style': 'text-align: center; margin-left: auto; margin-right: auto;' }).inject($('resultspringer'));
			var overlapChart = new google.visualization.PieChart(document.getElementById('overlapChart'));
			var overlapStats = new google.visualization.DataTable();
			overlapStats.addColumn('string', 'Overlap');
			overlapStats.addColumn('number', 'Number of results');
			overlapStats.addRow([ 'opacmo', Object.keys(opacmoStats['dois']).length - overlaps ]);
			overlapStats.addRow([ 'Springer', response.result.records.length - overlaps ]);
			overlapStats.addRow([ 'both', overlaps ]);
			overlapChart.draw(overlapStats, { 'width': 500, 'height': 600, 'fontName': 'Helvetica', 'fontSize': 12, 'backgroundColor': '#eeeeee', 'legend': { 'position': 'bottom' } });

			// Top-25 only!
			new Element('div#yearChart', { 'style': 'text-align: center; margin-left: auto; margin-right: auto;' }).inject($('resultspringer'));
			var yearDistribution = new google.visualization.DataTable();
			yearDistribution.addColumn('string', 'Year');
			yearDistribution.addColumn('number', 'opacmo');
			yearDistribution.addColumn('number', 'Springer');
			var yearOpacmoInterval = getYearInterval(opacmoStats['distribution']);
			var yearSpringerInterval = getYearInterval(springerStats['distribution']);
			var yearMin = yearOpacmoInterval[0] < yearSpringerInterval[0] ? yearOpacmoInterval[0] : yearSpringerInterval[0];
			var yearMax = yearOpacmoInterval[1] > yearSpringerInterval[1] ? yearOpacmoInterval[1] : yearSpringerInterval[1];
			if (opacmoStats['distribution'][''] || springerStats['distribution']['']) {
				var opacmoYearUnknown = opacmoStats['distribution'][''] ? opacmoStats['distribution'][''] : 0;
				var springerYearUnknown = springerStats['distribution'][''] ? springerStats['distribution'][''] : 0;

				yearDistribution.addRow([ 'unknown', opacmoYearUnknown, springerYearUnknown ]);
			}
			for (var year = yearMin; year <= yearMax; year++) {
				var opacmoYear = opacmoStats['distribution']['' + year] || 0;
				var springerYear = springerStats['distribution']['' + year] || 0;

				yearDistribution.addRow([ '' + year, opacmoYear, springerYear ]);
			}
			var yearChart = new google.visualization.ColumnChart(document.getElementById('yearChart'));
			yearChart.draw(yearDistribution, { 'width': 500, 'height': 600, 'fontName': 'Helvetica', 'fontSize': 12, 'backgroundColor': '#eeeeee', 'legend': { 'position': 'bottom' } });

			resultSpinner.hide();
		}
	});

function makeDocumentView(
		continuousNumber,
		pmcidElement,
		doiElement,
		titleElement,
		journalElement,
		yearElement,
		pmcid,
		doi,
		title,
		journal,
		year
	) {
	new Element('span', { 'html': '' + continuousNumber + '.&nbsp;' }).inject(titleElement);

	var clazz = 'resulttitle';
	if (pmcidElement != null && selectedEntities['PMC ID%' + pmcid])
		clazz = 'resulttitle-selected';

	/*
	   If a PMC ID Element is given, link out via the PMC ID,
	   otherwise, if PMC ID is null too, then link out via DOI,
	   otherwise, use the PMC ID as a link...
	 */
	var linkOut;
	if (pmcidElement)
		linkOut = 'http://www.ncbi.nlm.nih.gov/pmc/articles/' + pmcid;
	else if (pmcid == null)
		linkOut = 'doi://' + doi;
	else
		linkOut = pmcid;

	var entity = new Element('a', {
		'class': clazz,
		'href': linkOut,
		'target': '_blank'
	});
	entity.set('html', title);
	entity.inject(titleElement);

	journalElement.set('html', journal);
	yearElement.set('html', year);

	entity = new Element('a', {
		'class': clazz,
		'href': linkOut,
		'target': '_blank'
	});
	entity.set('html', 'doi:' + doi);
	entity.inject(doiElement);

	entity = new Element('a', {
		'class': clazz,
		'href': linkOut,
		'target': '_blank'
	});
	entity.set('html', pmcid);
	if (pmcidElement)
		entity.inject(pmcidElement);
}

function getYearInterval(distribution) {
	var yearMin = 2011, yearMax = new Date().getFullYear();

	for (var year in distribution) {
		if (year.length == 4) {
			year = parseInt(year);
			if (year < yearMin)
				yearMin = year;
			else if (year > yearMax)
				yearMax = year;
		}
	}

	return [ yearMin, yearMax ];
}

function topbar_activate(id) {
	$('topbar_home').erase('class');
	$('topbar_about').erase('class');
	$('topbar_release').erase('class');
	$('topbar_galaxy').erase('class');
	$('topbar_acknowledgements').erase('class');

	$(id).set('class', 'active');
}

function topbar_hide_modals() {
	topbar_activate('topbar_home');
	$('juice').set('class', 'modal hide');
	$('about').set('class', 'modal hide');
	$('release').set('class', 'modal hide');
	$('galaxy').set('class', 'modal hide');
	$('acknowledgements').set('class', 'modal hide');
}

function makeDownload(format, clazz) {
	var downloadButton = new Element('div#download' + format, {
		'class': clazz,
		'html': format.toUpperCase()
	});
	downloadButton.addEvent('click', function() {
		runConjunctiveQuery(format);
	});
	downloadButton.inject($('resultdownloads'));
}

function makeRow(header, clazz, row, container, name, id, score, linkOut) {
	if (row == 0) {
		var label = new Element('span', { 'class': 'linkedlabel' })
		label.appendText(header);
		label.inject(container);
	}

	if (selectedEntities[header + '%' + name] || selectedEntities[header + '%' + id])
		clazz = clazz + '-selected';

	score = parseInt(score);
	clipped_score = score >>> 1;
	clipped_score = clipped_score < 5 ? 5 : clipped_score;
	clipped_score = clipped_score > 15 ? 15 : clipped_score;

	var entity = new Element('a', {
		'class': clazz,
		'href': linkOut,
		'target': '_blank'
	});

	// TODO Insert mouse over pop-up with ID? What about touch devices?
	entity.set('html', '<span style="color: #ffffff; background-color: #' + (clipped_score).toString(16) + '55555;">&nbsp;Score ' + score  + '&nbsp;</span>&nbsp;&nbsp;' + name.replace(/ /g, '&nbsp;') + '&nbsp;');
	entity.inject(container);
}

function presentSuggestion(title) {
	var suggestions = $('suggestioncontainer').getChildren();

	if (!suggestions)
		return false;

	for (var i = 0; i < suggestions.length; i++) {
		var table = suggestionTables[suggestions[i].id];

		if (table && table.getSelected().length != 0 &&
			table.getHead().getChildren()[0].innerHTML == title)
			return true;
	}

	return false;
}

function clearSuggestions() {
	var suggestions = $('suggestioncontainer').getChildren();

	if (!suggestions)
		return;

	for (var i = 0; i < suggestions.length; i++) {
		var table = suggestionTables[suggestions[i].id];

		if (!table || table.getSelected().length == 0) {
			// Get rid of suggestions that were not selected.
			delete suggestionTables[suggestions[i].id];
			delete suggestionColumns[suggestions[i].id];
			suggestions[i].dispose();
		}
	}
}

function discardSelection() {

}

function makeTable(container, matrix, headers, result) {
	var options = {
		properties: {
			border: 0,
			cellspacing: 5
		},
		selectable: true,
		allowMultiSelect: false
	};

	if (result) {
		options['rows'] = matrix.result;
		headers = [];

		if (!headers)
			return;

		if (headers[0] == 'titles')
			headers = [
				column2Header['pmcid'],
				column2Header['titles']
			];
		else
			for (var column in matrix.selection)
				headers.push(column2Header[matrix.selection[column]]);
	} else
		options['rows'] = matrix;

	if (headers) {
		// TODO It is not possible to set multiple constraints on
		// a single column.
		if (headers.length == 1 && presentSuggestion(headers[0]))
			return;

		options['headers'] = headers;
	}

	var id = 's' + suggestionTableCounter++;
	var wrapper = new Element('div#' + id);

	var closeButton = new Element('img#c' + id, {
		'class': 'closebutton',
		'src': opacmoBaseURI + '/images/gray_light/x_alt_12x12.png'
	});
	closeButton.addEvent('click', function() {
		if ($('c' + id).getStyle('opacity') != 1)
			return;

		var fadeOut = new Fx.Morph($(id), { duration: 'long' });

		fadeOut.addEvent('complete', function() {
			$(id).dispose();
			browseOffset = 0;
			if ($('resultcontainer').getChildren().length == 0)
				helperSliders['help2'].slideOut();
			runConjunctiveQuery();
			if ($('suggestioncontainer').getChildren().length == 0)
				helperSliders['help1'].slideOut();
		});

		fadeOut.start({
			opacity: [ 1, 0 ]
		});
	});
	closeButton.addEvent('mouseover', function() {
		closeButton.setProperty('src', opacmoBaseURI + '/images/red/x_alt_12x12.png');
	});
	closeButton.addEvent('mouseleave', function() {
		closeButton.setProperty('src', opacmoBaseURI + '/images/gray_light/x_alt_12x12.png');
	});

	var htmlTable = new HtmlTable(options);

	htmlTable.addEvent('rowFocus', function(row) {
		if (workaroundHtmlTable && workaroundHtmlTable == htmlTable && workaroundHtmlTableRow == row)
			htmlTable.deselectRow(row);

		workaroundHtmlTable = null;

		$('query').value = '';
		browseOffset = 0;
		runConjunctiveQuery();

	});
	htmlTable.addEvent('rowUnfocus', function(row) {
		workaroundHtmlTable = htmlTable;
		workaroundHtmlTableRow = row;

		browseOffset = 0;
		runConjunctiveQuery();
	});

	wrapper.addClass('suggestiontable');
	closeButton.inject(wrapper);
	htmlTable.inject(wrapper);
	wrapper.inject(container);

	if (container == $('suggestioncontainer'))
		suggestionTables[id] = htmlTable;

	return id;
}

function processQuery() {
	var query = $('query').value;

	if (!query || query.length < 2)
		return;

	query = query.replace(/^ +/, '')
	query = query.replace(/ +$/, '')

	if ($('optionHelpMessages').checked) {
		helperSliders['help0'].slideIn();
		helperSliders['help1'].slideIn();
	}

	var yoctogiClauses = {
		entrezname: query
	};

	if (query.toUpperCase().match(/^(P|PM|PMC|PMC\d+)$/))
		yoctogiClauses['pmcid'] = query;
	if (query.match(/^[a-zA-Z].*$/)) {
		yoctogiClauses['speciesname'] = query;
		yoctogiClauses['goname'] = query;
		yoctogiClauses['doname'] = query;
		yoctogiClauses['chebiname'] = query;
	}
	if (query.match(/^\d+$/)) {
		yoctogiClauses['entrezid'] = query;
		yoctogiClauses['speciesid'] = query;
	}
	if (query.toUpperCase().match(/^(G|GO|GO:|GO:\d+)$/))
		yoctogiClauses['goid'] = query;
	if (query.toUpperCase().match(/^(D|DO|DO:|DOI:|DOID:|DOID:\d+)$/))
		yoctogiClauses['doid'] = query;
	if (query.toUpperCase().match(/^(C|CH|CHE:|CHEB:|CHEBI:|CHEBI:|CHEBI:\d+)$/))
		yoctogiClauses['chebiid'] = query;

	var yoctogiOptions = { like: true, batch: true, distinct: true, caseinsensitive: !$('optionCaseSensitive').checked, limit: yoctogiSuggestionLimit }

	var yoctogiRequest = { clauses: yoctogiClauses, options: yoctogiOptions  }

	if ($('secondstage').getStyle('opacity') == 0) {
		new Fx.Morph($('secondstage'), { duration: 'short' }).start({ opacity: [ 0, 1 ] });
	}

	suggestionSpinner.show();
	suggestionRequest.send(JSON.encode(yoctogiRequest));
}

function runConjunctiveQuery(format) {
	var suggestions = $('suggestioncontainer').getChildren();

	if (!suggestions)
		return;

	selectedEntities = {};

	var yoctogiClausesLength = 0;
	var yoctogiClauses = {};
	var springerTerms = [];

	for (var i = 0; i < suggestions.length; i++) {
		var table = suggestionTables[suggestions[i].id];

		if (table && table.getSelected().length > 0) {
			var selectedTDs = table.getSelected()[0].getChildren();

			for (var j = 0; j < selectedTDs.length; j++) {
				yoctogiClausesLength++;
				var currentAssignment = yoctogiClauses[suggestionColumns[suggestions[i].id]];
				if (!currentAssignment)
					yoctogiClauses[suggestionColumns[suggestions[i].id]] = [ selectedTDs[j].innerHTML ];
				else {
					currentAssignment.push(selectedTDs[j].innerHTML);
					yoctogiClauses[suggestionColumns[suggestions[i].id]] = currentAssignment;
				}
				selectedEntities[header2ResultHeader[table.head.getChildren()[0].innerHTML] +
					'%' + selectedTDs[j].innerHTML] = true;;
				springerTerms.push(selectedTDs[j].innerHTML);
			}
		}
	}

	if (!format) {
		$('resultdownloads').empty();
		$('resultbrowse').empty();
		$('resultcontainer').empty();

		nextSortedSelected = [];
		if (yoctogiClauses['entrezname'] || yoctogiClauses['entrezid']) {
			sortedByEntrez.set('style', 'display: inline;');
			nextSortedSelected.push('entrezscore');
		} else
			sortedByEntrez.set('style', 'display: none;');
		if (yoctogiClauses['speciesname'] || yoctogiClauses['speciesid']) {
			sortedBySpecies.set('style', 'display: inline;');
			nextSortedSelected.push('speciesscore');
		} else
			sortedBySpecies.set('style', 'display: none;');
		if (yoctogiClauses['goname'] || yoctogiClauses['goid']) {
			sortedByGO.set('style', 'display: inline;');
			nextSortedSelected.push('goscore');
		} else
			sortedByGO.set('style', 'display: none;');
		if (yoctogiClauses['doname'] || yoctogiClauses['doid']) {
			sortedByDO.set('style', 'display: inline;');
			nextSortedSelected.push('doscore');
		} else
			sortedByDO.set('style', 'display: none;');
		if (yoctogiClauses['chebiname'] || yoctogiClauses['chebiid']) {
			sortedByChEBI.set('style', 'display: inline;');
			nextSortedSelected.push('chebiscore');
		} else
			sortedByChEBI.set('style', 'display: none;');

		if (nextSortedSelected.indexOf(sortedSelected) < 0 && nextSortedSelected.length > 0)
			sortedSelected = nextSortedSelected[0];
	}

	if (yoctogiClausesLength == 0)
		return;

	if (!format) {
		if ($('thirdstage').getStyle('opacity') == 0) {
			new Fx.Morph($('thirdstage'), { duration: 'short' }).start({ opacity: [ 0, 1 ] });
		}
	}

	resultSpinner.show();

	var yoctogiOptions = {
		distinct: true,
		notempty: 0,
		orderby: 2,
		orderdescending: true,
		count: true,
		offset: browseOffset,
		limit: yoctogiAggregateLimit,
		aggregateorder: [ sortedSelected ],
		aggregateorderdescending: true
	};

	if (format)
		yoctogiOptions['format'] = format;

	// Keep track of the Springer terms for later, since they will be needed when
	// the results come back from opacmo:
	yoctogiOptions['springerterms'] = springerTerms;

	var yoctogiRequest = {
		aggregate: {
			pmcid: [
				['pmcid']
			]
		},
		clauses: yoctogiClauses,
		dimensions: { publications: { pmcid: [ 'pmid', 'doi', 'pmctitle', 'journal', 'year', 'entrez_ner', 'species_ner', 'go_ner', 'do_ner', 'chebi_ner' ] } },
		options: yoctogiOptions
	};

	resultRequest.send(JSON.encode(yoctogiRequest));
}

function updateSortedButtons() {
	sortedByEntrez.set('class', 'sortedbutton');
	sortedBySpecies.set('class', 'sortedbutton');
	sortedByGO.set('class', 'sortedbutton');
	sortedByDO.set('class', 'sortedbutton');
	sortedByChEBI.set('class', 'sortedbutton');

	if (sortedSelected == 'entrezscore')
		sortedByEntrez.set('class', 'sortedbutton-selected');
	else if (sortedSelected == 'speciesscore')
		sortedBySpecies.set('class', 'sortedbutton-selected');
	else if (sortedSelected == 'goscore')
		sortedByGO.set('class', 'sortedbutton-selected');
	else if (sortedSelected == 'doscore')
		sortedByDO.set('class', 'sortedbutton-selected');
	else if (sortedSelected == 'chebiscore')
		sortedByChEBI.set('class', 'sortedbutton-selected');
}

function updateHelpers() {
	if ($('optionHelpMessages').checked) {
		helperSliders['help0'].slideIn();
		if ($('secondstage').getStyle('opacity') == 1 && $('suggestioncontainer').getChildren().length > 0)
			helperSliders['help1'].slideIn();
		if ($('thirdstage').getStyle('opacity') == 1 && $('resultcontainer').getChildren().length > 0)
			helperSliders['help2'].slideIn();
	} else {
		helperSliders['help0'].slideOut();
		helperSliders['help1'].slideOut();
		helperSliders['help2'].slideOut();
	}
}

$(window).onload = function() {
	$('secondstage').setStyle('opacity', '0');
	$('thirdstage').setStyle('opacity', '0');

	new Fx.Accordion($('release'), '#release h4', '#release .releasenote');

	$('optionHelpMessages').addEvent('click', function() {
		updateHelpers();
	});

	$('optionCaseSensitive').addEvent('click', function() {
		processQuery();
	});

	// Okay.. this really needs to become a function..
	helperSliders['help0'] = new Fx.Slide('help0', { mode: 'vertical' }).hide();
	helperSliders['help1'] = new Fx.Slide('help1', { mode: 'vertical' }).hide();
	helperSliders['help2'] = new Fx.Slide('help2', { mode: 'vertical' }).hide();

	if (updateInProgress) {
		$('query').disabled = true;

		new Element('div', {
			'class': 'notificationimportant',
			'html': 'The database is currently being updated. Please check back later.'
		}).inject($('notifications'));

		$('query').alt = '--- disabled due to update ---';
	} else
		helperSliders['help0'].toggle();

	$('query').addEvent('keyup', function() {
		clearTimeout(processQueryTimeOutID);
		processQueryTimeOutID = processQuery.delay(250);
	});
	// Cannot deal with the vertical slide outs:
	// queryOverText = new OverText($('query'));

	suggestionSpinner = new Spinner('suggestionspinner');
	resultSpinner = new Spinner('resultspinner');
	relativeSpinnerDiv = new Element('div', {
		'class': 'relativespinner-img'
	});
	springerSpinner = new Spinner('springerspinner', { 'class': 'relativespinner', 'img': relativeSpinnerDiv });

	browseLeft.addEvent('click', function() {
		if (browseOffset - yoctogiAggregateLimit >= 0)
			browseOffset -= yoctogiAggregateLimit;
		runConjunctiveQuery();
	});
	browseRight.addEvent('click', function() {
		if (browseOffset + yoctogiAggregateLimit < browseMax)
			browseOffset += yoctogiAggregateLimit;
		runConjunctiveQuery();
	});

	sortedByEntrez.addEvent('click', function() {
		if (sortedSelected == 'entrezscore')
			return;
		sortedSelected = 'entrezscore';
		updateSortedButtons();
		runConjunctiveQuery();
	});
	sortedBySpecies.addEvent('click', function() {
		if (sortedSelected == 'speciesscore')
			return;
		sortedSelected = 'speciesscore';
		updateSortedButtons();
		runConjunctiveQuery();
	});
	sortedByGO.addEvent('click', function() {
		if (sortedSelected == 'goscore')
			return;
		sortedSelected = 'goscore';
		updateSortedButtons();
		runConjunctiveQuery();
	});
	sortedByDO.addEvent('click', function() {
		if (sortedSelected == 'doscore')
			return;
		sortedSelected = 'doscore';
		updateSortedButtons();
		runConjunctiveQuery();
	});
	sortedByChEBI.addEvent('click', function() {
		if (sortedSelected == 'chebiscore')
			return;
		sortedSelected = 'chebiscore';
		updateSortedButtons();
		runConjunctiveQuery();
	});
}

