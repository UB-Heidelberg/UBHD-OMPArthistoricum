# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''
from ompdal import OMPDAL

locale = 'de_DE'
if session.forced_language == 'en':
  locale = 'en_US'

def vmps_info():
	return dict()

def eva_info():
        return dict()

def dbae_info():
        return dict()

def palatium_info():
        return dict()


def index():
  ompdal = OMPDAL(db, myconf)

  series_rows = ompdal.getSeries()
  if len(series_rows) == 0:
    raise HTTP(200, "'invalid': no series in this press")

  setting_types = ['title', 'subtitle', 'description', 'prefix']
  series = []
  for s in series_rows:
    series_info = dict()
    series_info['path'] = s.path
    series_info['image'] = s.image
    settings = ompdal.getLocalizedSeriesSettings(s.series_id, locale)
    if not settings:
      settings = ompdal.getSeriesSettings(s.series_id)
    for st in settings:
      if st.setting_name in setting_types:
        series_info[st.setting_name] = st.setting_value
    series.append(series_info)

  series.sort(key=lambda s: s.get('title', 'z'))
  return dict(series=series)
