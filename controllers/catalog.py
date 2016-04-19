# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''

import os
from operator import itemgetter
from ompdal import OMPDAL, Settings, Item

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
    locale = 'de_DE'
    if session.forced_language == 'en':
        locale = 'en_US'
    ignored_submissions =  myconf.take('omp.ignore_submissions') if myconf.take('omp.ignore_submissions') else -1
    query = ((db.submissions.context_id == myconf.take('omp.press_id')) & (db.submissions.submission_id!=ignored_submissions) & (db.submissions.status == 3) & (
        db.submission_settings.submission_id == db.submissions.submission_id) & (db.submission_settings.locale == locale))
    submissions = db(query).select(db.submission_settings.ALL, db.submissions.series_id, db.submissions.series_position,
                                   orderby=~db.submissions.date_submitted)
    subs = {}
    order = []
    series_info = {}
    ompdal = OMPDAL(db, myconf)
    for i in submissions:
        id = i.submission_settings.submission_id
        if id not in order:
            order.append(id)
        setting_name = i.submission_settings.setting_name
        setting_value = i.submission_settings.setting_value
        if setting_name == 'abstract':
            subs.setdefault(id, {})['abstract'] = setting_value
        if setting_name == 'subtitle':
            subs.setdefault(id, {})['subtitle'] = setting_value
        if setting_name == 'title':
            subs.setdefault(id, {})['title'] = setting_value
        subs.setdefault(id, {})['authors'] = ompdal.getAuthors(id)
        for row in ompdal.getPublicationDates(id):
            if row['date_format'] == '00':
                subs[id]['publication_date'] = row['date']
        subs[id]['editors'] = ompdal.getEditors(id)
        subs[id]['series_position'] = i.submissions.series_position
        series_id = i.submissions.series_id
        if series_id != 0:
            subs[id]['series_id'] = series_id
            if series_id not in series_info:
                series_settings = ompdal.getLocalizedSeriesSettings(series_id, locale)
                if not series_settings:
                    series_settings = ompdal.getSeriesSettings(series_id)
                series_info[series_id] = {}
                for s in series_settings:
                    if s.setting_name == 'title':
                        series_info[series_id]['title'] = s.setting_value
                    if s.setting_name == 'subtitle':
                        series_info[series_id]['subtitle'] = s.setting_value

    return locals()

def book():
    out = ""
    
    locale = ''
    if session.forced_language == 'en':
        locale = 'en_US'
    if session.forced_language == 'de':
        locale = 'de_DE'

    # Get submission id from request
    submission_id = request.args[0] if request.args else redirect(
        URL('home', 'index'))
    
    ompdal = OMPDAL(db, myconf)
    
    # Get press and press settings
    press = ompdal.getPress(myconf.take('omp.press_id'))
    if not press:
        redirect(URL('home', 'index'))        
    
    press_settings = Settings(ompdal.getPressSettings(press.press_id))    
    
    # Get basic submission info (check, if submission is associated with the actual press and if the submission has been published)
    submission = ompdal.getPublishedSubmission(submission_id, press=myconf.take('omp.press_id'))    
    if not submission:
        redirect(URL('home', 'index'))

    submission_settings = Settings(ompdal.getSubmissionSettings(submission_id))
    
    # Get contributors and contributor settings
    authors = []
    for author in ompdal.getAuthorsBySubmission(submission_id):
        authors.append(Item(author,
                            Settings(ompdal.getAuthorSettings(author.author_id)),
                        )
        )
    
    editors = []
    for editor in ompdal.getEditorsBySubmission(submission_id):
        editors.append(Item(editor,
                            Settings(ompdal.getAuthorSettings(editor.author_id)),
                        )
        )
    
    chapters = []
    for chapter in ompdal.getChaptersBySubmission(submission_id):
        chapters.append(Item(chapter,
                             Settings(ompdal.getChapterSettings(chapter.chapter_id)),
                             {'authors': [Item(a, Settings(ompdal.getAuthorSettings(a.author_id))) for a in ompdal.getAuthorsByChapter(chapter.chapter_id)]}
                            )
        )
        
    # Get DOI from the format marked as DOI carrier
    pdf = ompdal.getPublicationFormatByName(submission_id, myconf.take('omp.doi_format_name')).first()
    if pdf:
        doi = ompdal.getLocalizedPublicationFormatSettingValue(pdf.publication_format_id, "pub-id::doi", "")    # DOI always has empty locale
    else:
        doi = None

    # Get digital publication formats, settings and files
    digital_publication_formats = []
    for pf in ompdal.getDigitalPublicationFormats(submission_id, available=True, approved=True):
        digital_publication_formats.append(Item(pf, 
            Settings(ompdal.getPublicationFormatSettings(pf.publication_format_id)),
            {'file': ompdal.getLatestRevisionOfFullBook(submission_id, pf.publication_format_id),
             'identification_codes': ompdal.getIdentificationCodesByPublicationFormat(pf.publication_format_id)
            }
            )
        )
        for chapter in chapters:
            chapter_file = ompdal.getLatestRevisionOfChapter(chapter.attributes.chapter_id, pf.publication_format_id)
            chapter.associated_items.setdefault('files', {})[pf.publication_format_id] = chapter_file
            
    # Get physical publication formats and settings
    physical_publication_formats = []
    for pf in ompdal.getPhysicalPublicationFormats(submission_id, available=True, approved=True):
        physical_publication_formats.append(Item(pf, 
            Settings(ompdal.getPublicationFormatSettings(pf.publication_format_id)),
            {'identification_codes': ompdal.getIdentificationCodesByPublicationFormat(pf.publication_format_id)}
            )
        )

    date_pub_query =  (db.publication_formats.submission_id == submission_id) & (db.publication_format_settings.publication_format_id == db.publication_formats.publication_format_id)
    published_date = db(date_pub_query & (db.publication_format_settings.setting_value == myconf.take('omp.doi_format_name')) & (
        db.publication_dates.publication_format_id == db.publication_format_settings.publication_format_id)).select(db.publication_dates.date)

    representatives = db(
        (db.representatives.submission_id == submission_id) & (
            db.representatives.representative_id_type == myconf.take('omp.representative_id_type'))).select(
        db.representatives.name,
        db.representatives.url,
        orderby=db.representatives.representative_id)

    full_files = ompdal.getLatestRevisionsOfFullBook(submission_id)
    xml = ompdal.getPublicationFormatByName(submission_id, "XML")

    cover_image = ''
    path = request.folder+'static/monographs/'+submission_id+'/simple/cover.'
    for t in ['jpg','png','gif']:
        if os.path.exists(path+t):
                cover_image = URL(myconf.take('web.application'), 'static','monographs/' + submission_id + '/simple/cover.'+t)

    return locals()
