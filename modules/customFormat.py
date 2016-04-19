# -*- coding: utf-8 -*-

from html import URL

def formatAuthor(author_row, reverse=False):
    """
    Format author names for citations.
    """
    if not reverse:
        return " ".join([author_row.first_name, author_row.middle_name, author_row.last_name])
    else:
        return "{}, {}".format(author_row.last_name, " ".join([author_row.first_name, author_row.middle_name]).strip())

def downloadLink(application, file_row):
    """
    Generate download link from file info.
    """
    file_type = file_row.file_type.split('/').pop().strip().lower()
    file_name_items = [file_row.submission_id,
                       file_row.genre_id,
                       file_row.file_id,
                       file_row.revision,
                       file_row.file_stage,
                       file_row.date_uploaded.strftime('%Y%m%d'),
                       ]
    file_name = '-'.join([str(i) for i in file_name_items])+'.'+file_type
    
    if file_type == 'html':
        op = 'index'
    else:
        op = 'download'
    
    return URL(application, 
               'reader',
               op,
               args=[file_row.submission_id, file_name]
               )