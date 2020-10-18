import https from 'https'
import split from 'split2'
import {SanityDocument} from '@sanity/types'
import {StreamResult} from '../types'
import {getError, isRelevantDocument, isStreamError} from '../exportUtils'

export function getDocuments(
  projectId: string,
  dataset: string,
  token?: string
): Promise<SanityDocument[]> {
  const headers = token ? {Authorization: `Bearer ${token}`} : undefined
  const options: https.RequestOptions = {
    hostname: `${projectId}.api.sanity.io`,
    path: `/v1/data/export/${dataset}`,
    protocol: 'https:',
    headers,
  }

  return new Promise((resolve, reject) => {
    https
      .request(options, (response) => {
        response.setEncoding('utf8')

        const chunks: Buffer[] = []
        if (response.statusCode !== 200) {
          response
            .on('data', (chunk: Buffer) => chunks.push(chunk))
            .on('end', () => {
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
              reject(new Error(`Error streaming dataset: ${getError(body)}`))
            })
          return
        }

        const documents: SanityDocument[] = []
        response
          .pipe(split(JSON.parse))
          .on('data', (doc: StreamResult) => {
            if (isStreamError(doc)) {
              reject(new Error(`Error streaming dataset: ${doc.error}`))
              return
            }

            if (doc && isRelevantDocument(doc)) {
              documents.push(doc)
            }
          })
          .on('end', () => resolve(documents))
      })
      .end()
  })
}
