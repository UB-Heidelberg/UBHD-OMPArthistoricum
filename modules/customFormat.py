# -*- coding: utf-8 -*-

from html import URL

def formatAuthor(author):
    return " ".join([author.first_name, author.middle_name, author.last_name])

def formatAuthorCitationStyle(author):
    return "{}, {}".format(author.last_name, " ".join([author.first_name, author.middle_name]).strip())

def downloadLink(application, file_row):
    file_name_items = [file_row.submission_id,
                       file_row.genre_id,
                       file_row.file_id,
                       file_row.revision,
                       file_row.file_stage,
                       file_row.date_uploaded.strftime('%Y%m%d'),
                       file_row.file_type.split('/').pop().strip().lower()
                       ]
    file_name = '-'.join([str(i) for i in file_name_items])
    return URL(application, 
               'reader',
               'download',
               args=[file_row.submission_id, file_name]
               )