# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''
response.title = settings.title
response.subtitle = settings.subtitle
response.meta.keywords = settings.keywords
response.meta.description = settings.description
response.menu = []

if session.forced_language == 'en':
    locale = 'en_US'
elif session.forced_language == 'de':
    locale = 'de_DE'
else:
    locale = 'de_DE'

