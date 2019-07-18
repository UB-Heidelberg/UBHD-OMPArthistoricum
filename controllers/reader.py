# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''

# required - do no delete
import os

from ompdal import OMPDAL, OMPSettings, OMPItem
import ompformat

def user(): return dict(form=auth())
# ef download(): return response.download(request,db)

def call():
    session.forget()
    return service()
# end requires

def index():
    ompdal = OMPDAL(db, myconf)
    from gluon.serializers import json
    json_list = dict(xml_url='')
    locale = 'de_DE'
    if session.forced_language == 'en':
        locale = 'en_US'
    if len(request.args) < 2:
        raise HTTP(404)
    submission_id = request.args[0]
    file_id = request.args[1]
    path = os.path.join(request.folder, 'static/files/presses', myconf.take('omp.press_id'), 'monographs',
                        submission_id, 'submission/proof', file_id)
    if os.path.exists(path) is False:
        raise HTTP(404)

    # check if it is xml
    if str(file_id).endswith('.xml'):
        authors = [OMPItem(author, OMPSettings(ompdal.getAuthorSettings(author.author_id)))
                   for author in ompdal.getAuthorsBySubmission(submission_id)]
        authors_string = ', '.join((ompformat.formatName(a.settings) for a in authors))

        return dict(json_list=XML(json(json_list)), authors=authors_string)
    else:
        path = os.path.join(request.folder, 'static/files/presses', myconf.take('omp.press_id'), 'monographs',
                            submission_id, 'submission/', file_id)
        return response.stream(path, chunk_size=1048576)

def home():
    return dict()

def download():
    submission_id = request.args[0]
    submission_file = request.args[1]
    path = os.path.join(request.folder, 'static/files/presses', myconf.take('omp.press_id'), 'monographs',
                        submission_id, 'submission/proof', submission_file)
    response.headers['ContentType'] = "application/octet-stream"
    response.headers[
        'Content-Disposition'] = "attachment; filename=" + submission_file
    return response.stream(path, chunk_size=1048576)

def download_image():
    submission_id = request.args[0]
    submission_file = request.args[1]
    path = os.path.join(request.folder, 'static/files/presses', myconf.take('omp.press_id'), 'monographs',
                        submission_id, 'submission', submission_file)
    return response.stream(path)
