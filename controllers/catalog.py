# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''

import os
from operator import itemgetter
from ompdal import OMPDAL, Settings, OMPItem

def series():
    abstract, author, cleanTitle, subtitle = '', '', '', ''
    locale = 'de_DE'
    if session.forced_language == 'en':
        locale = 'en_US'
    ignored_submissions =  myconf.take('omp.ignore_submissions') if myconf.take('omp.ignore_submissions') else -1
    
    if request.args == []:
      redirect( URL('home', 'index'))
    series = request.args[0]
    
    query = ((db.submissions.context_id == myconf.take('omp.press_id'))  &  (db.submissions.submission_id!=ignored_submissions) & (db.submissions.status == 3) & (
        db.submission_settings.submission_id == db.submissions.submission_id) & (db.submission_settings.locale == locale) & (db.submissions.context_id==db.series.press_id) & (db.series.path==series) & (db.submissions.context_id == myconf.take('omp.press_id')) & (db.submissions.series_id==db.series.series_id) &(db.submissions.context_id==db.series.press_id) & (db.series.path==series))
    submissions = db(query).select(db.submission_settings.ALL,orderby=db.submissions.submission_id)
    submissions = db(query).select(db.submission_settings.ALL,orderby=db.submissions.series_position|~db.submissions.date_submitted)
    subs = {}

    series_title = ""
    series_subtitle = ""
    rows = db(db.series.path == series).select(db.series.series_id)
    if len(rows) == 1:
        series_id = rows[0]['series_id']
    	rows = db((db.series_settings.series_id == series_id) & (db.series_settings.setting_name == 'title') & (db.series_settings.locale == locale)).select(db.series_settings.setting_value)
	if rows:
	    series_title=rows[0]['setting_value']
	rows = db((db.series_settings.series_id == series_id) & (db.series_settings.setting_name == 'subtitle') & (db.series_settings.locale == locale)).select(db.series_settings.setting_value)
        if rows:
            series_subtitle=rows[0]['setting_value']

    series_positions = {}
    order = []
    for i in submissions:
      if not i.submission_id in order:
	order.append(i.submission_id)
      series_position = db(db.submissions.submission_id == i.submission_id).select(db.submissions.series_position).first()['series_position']
      if series_position:
         subs.setdefault(i.submission_id, {})['series_position'] = series_position
	 pos_counter = 0
         try:
	   int_pos = int(series_position)
	   series_positions[i.submission_id] = int_pos
	 except:
	   series_positions[i.submission_id] = pos_counter
	   pos_counter += 1
      authors=''
      if i.setting_name == 'abstract':
          subs.setdefault(i.submission_id, {})['abstract'] = i.setting_value
      if i.setting_name == 'subtitle':
          subs.setdefault(i.submission_id, {})['subtitle'] = i.setting_value
      if i.setting_name == 'title':
          subs.setdefault(i.submission_id, {})[
              'title'] = i.setting_value
      author_q = ((db.authors.submission_id == i.submission_id))
      authors_list = db(author_q).select(
          db.authors.first_name, db.authors.last_name, db.authors.seq, orderby=db.authors.seq)
      for j in authors_list:
          authors += j.first_name + ' ' + j.last_name + ', '
      if authors.endswith(', '):
        authors = authors[:-2]
          
      subs.setdefault(i.submission_id, {})['authors'] = authors
      if series_positions != {}:
        order = [e[0] for e in sorted(series_positions.items(), key=itemgetter(1), reverse=True)]

    return dict(submissions=submissions, subs=subs, order=order, series_title=series_title, series_subtitle=series_subtitle)

def index():
    locale = ''
    if session.forced_language == 'en':
        locale = 'en_US'
    if session.forced_language == 'de':
        locale = 'de_DE'
    
    ompdal = OMPDAL(db, myconf)
    
    # Load press info from config
    press = ompdal.getPress(myconf.take('omp.press_id'))
    if not press:
        redirect(URL('home', 'index'))            
    press_settings = Settings(ompdal.getPressSettings(press.press_id))
    
    ignored_submission_id =  myconf.take('omp.ignore_submissions') if myconf.take('omp.ignore_submissions') else -1
    
    order = []
    submissions = []
    for submission_row in ompdal.getSubmissionsByPress(press.press_id, ignored_submission_id):
        authors = [OMPItem(author, Settings(ompdal.getAuthorSettings(author.author_id))) for author in ompdal.getAuthorsBySubmission(submission_row.submission_id)]
        editors = [OMPItem(editor, Settings(ompdal.getAuthorSettings(editor.author_id))) for editor in ompdal.getAuthorsBySubmission(submission_row.submission_id)]
        submission = OMPItem(submission_row,
                             Settings(ompdal.getSubmissionSettings(submission_row.submission_id)),
                             {'authors': authors, 'editors': editors}
        )
        series = ompdal.getSeries(submission_row.series_id)
        if series:
            submission.associated_items['series'] = OMPItem(series, Settings(ompdal.getSeriesSettings(series.series_id)))
            
        submissions.append(submission)
    
    return locals()

def book():
    locale = ''
    if session.forced_language == 'en':
        locale = 'en_US'
    if session.forced_language == 'de':
        locale = 'de_DE'

    submission_id = request.args[0] if request.args else redirect(
        URL('home', 'index'))
    
    ompdal = OMPDAL(db, myconf)
    
    # Load press info from config
    press = ompdal.getPress(myconf.take('omp.press_id'))
    if not press:
        redirect(URL('home', 'index'))            
    press_settings = Settings(ompdal.getPressSettings(press.press_id))
    
    # Get basic submission info (check, if submission is associated with the actual press and if the submission has been published)
    submission = ompdal.getPublishedSubmission(submission_id, press_id=myconf.take('omp.press_id'))    
    if not submission:
        redirect(URL('home', 'index'))

    submission_settings = Settings(ompdal.getSubmissionSettings(submission_id))
    
    # Get contributors and contributor settings
    authors = []
    for author in ompdal.getAuthorsBySubmission(submission_id):
        authors.append(OMPItem(author, Settings(ompdal.getAuthorSettings(author.author_id))))
    
    editors = []
    for editor in ompdal.getEditorsBySubmission(submission_id):
        editors.append(OMPItem(editor, Settings(ompdal.getAuthorSettings(editor.author_id))))
    
    # Get chapters and chapter authors
    chapters = []
    for chapter in ompdal.getChaptersBySubmission(submission_id):
        chapters.append(OMPItem(chapter,
                             Settings(ompdal.getChapterSettings(chapter.chapter_id)),
                             {'authors': [OMPItem(a, Settings(ompdal.getAuthorSettings(a.author_id))) for a in ompdal.getAuthorsByChapter(chapter.chapter_id)]})
        )
        
    # Get digital publication formats, settings, files, and identification codes
    digital_publication_formats = []
    for pf in ompdal.getDigitalPublicationFormats(submission_id, available=True, approved=True):
        digital_publication_formats.append(OMPItem(pf, 
            Settings(ompdal.getPublicationFormatSettings(pf.publication_format_id)),
            {'full_file': ompdal.getLatestRevisionOfFullBookFileByPublicationFormat(submission_id, pf.publication_format_id),
             'identification_codes': ompdal.getIdentificationCodesByPublicationFormat(pf.publication_format_id),
             'publication_dates': ompdal.getPublicationDatesByPublicationFormat(pf.publication_format_id)})
        )
        for chapter in chapters:
            chapter_file = ompdal.getLatestRevisionOfChapterFileByPublicationFormat(chapter.attributes.chapter_id, pf.publication_format_id)
            chapter.associated_items.setdefault('files', {})[pf.publication_format_id] = chapter_file
            
    # Get physical publication formats, settings, and identification codes
    physical_publication_formats = []
    for pf in ompdal.getPhysicalPublicationFormats(submission_id, available=True, approved=True):
        physical_publication_formats.append(OMPItem(pf, 
            Settings(ompdal.getPublicationFormatSettings(pf.publication_format_id)),
            {'identification_codes': ompdal.getIdentificationCodesByPublicationFormat(pf.publication_format_id),
             'publication_dates': ompdal.getPublicationDatesByPublicationFormat(pf.publication_format_id)})
        )
    
    # Get DOI from the format marked as DOI carrier
    pdf = ompdal.getPublicationFormatByName(submission_id, myconf.take('omp.doi_format_name'))
    if pdf:
        doi = Settings(ompdal.getPublicationFormatSettings(pdf.first().publication_format_id)).getLocalizedValue("pub-id::doi", "")    # DOI always has empty locale
    else:
        doi = None
    
    # Get purchase info
    representatives = ompdal.getRepresentativesBySubmission(submission_id, myconf.take('omp.representative_id_type'))
    
    # Get cover image
    cover_image = ''
    path = request.folder+'static/monographs/'+submission_id+'/simple/cover.'
    for t in ['jpg','png','gif']:
        if os.path.exists(path+t):
                cover_image = URL(myconf.take('web.application'), 'static','monographs/' + submission_id + '/simple/cover.'+t)

    return locals()
