# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''
locale = 'de_DE'
if session.forced_language == 'en':
  locale = 'en_US'

def hst():
	return dict()

def index():
  series = db((db.series.series_id==db.series_settings.series_id) & (db.series.press_id==myconf.take("omp.press_id")) & (db.series_settings.locale==locale)).select(db.series.path, db.series.image, db.series_settings.series_id, db.series_settings.setting_name, db.series_settings.setting_value, orderby= [db.series_settings.series_id, db.series_settings.setting_name] )
  series_metadata =[]
  types = ['title','description']
  prev_series = 0
  for  row in series:
    if row['series_settings']['series_id'] != prev_series:
      metadata = {}
      prev_series = row['series_settings']['series_id']
      metadata['path'] = row['series']['path']
      metadata['image'] = row['series']['image']
      series_metadata.append(metadata)
      
    for t in types:
      if row['series_settings']['setting_name']== t:
        metadata[t] =   row['series_settings']['setting_value']
    
        
  series_ids = db(db.series.press_id==myconf.take("omp.press_id")).select(db.series.series_id)
  if len(series_ids) == 0 :
    raise HTTP(200, "'invalid': no series in this press")
  return dict(series_ids=series_ids, series_metadata=series_metadata)
