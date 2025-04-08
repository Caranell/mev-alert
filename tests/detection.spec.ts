import request from 'supertest'

import { app, server } from '@/app'
import { DetectionRequest, DetectionResponse } from '@/modules/detection-module/dtos'
import { SWAP_SIGNATURES } from '@/modules/detection-module/service'
import { HTTP_STATUS_CODES } from '@/types'

import { jaredfromsubwayExampleTx } from './mev-txs/jaredfromsubway1'

const zeroAddress = '0x0000000000000000000000000000000000000000'

const requestPayload = jaredfromsubwayExampleTx

describe('Service Tests', () => {
    afterAll(async () => {
        server.close()
    })

    describe('Detection Controller', () => {
        test('detect success: potential MEV (jaredfromsubway)', async () => {
            const response = await request(app)
                .post('/detect')
                .send(requestPayload)
                .set('Content-Type', 'application/json')

            const body: DetectionResponse = response.body

            expect(response.status).toBe(HTTP_STATUS_CODES.OK)
            expect(body.chainId).toBe(requestPayload?.chainId)
            expect(body.error).toBeFalsy()
            expect(body.detected).toBe(true)
        })

        test('detect mev: no trace calls', async () => {
            const payload: DetectionRequest = {
                ...jaredfromsubwayExampleTx,
                trace: {
                    ...jaredfromsubwayExampleTx.trace,
                    calls: [],
                },
            }
            const response = await request(app)
                .post('/detect')
                .send(payload)
                .set('Content-Type', 'application/json')

            const body: DetectionResponse = response.body

            expect(response.status).toBe(HTTP_STATUS_CODES.OK)
            expect(body.detected).toBe(false)
        })

        test('detect mev: no swap calls', async () => {
            const payload: DetectionRequest = {
                ...jaredfromsubwayExampleTx,
                trace: {
                    ...jaredfromsubwayExampleTx.trace,
                    calls: [
                        {
                            from: jaredfromsubwayExampleTx.trace.from,
                            to: zeroAddress,
                            input: '0xabcdef12' + '0'.repeat(56),
                            gasUsed: '25000',
                            value: '0',
                            output: '0x',
                            calls: [],
                        },
                    ],
                },
            }
            const response = await request(app)
                .post('/detect')
                .send(payload)
                .set('Content-Type', 'application/json')

            const body: DetectionResponse = response.body

            expect(response.status).toBe(HTTP_STATUS_CODES.OK)
            expect(body.detected).toBe(false)
        })

        test('detect mev: funds returned', async () => {
            const payload: DetectionRequest = {
                ...jaredfromsubwayExampleTx,
                trace: {
                    ...jaredfromsubwayExampleTx.trace,
                    calls: [
                        {
                            from: jaredfromsubwayExampleTx.trace.from,
                            to: zeroAddress,
                            input: SWAP_SIGNATURES[0] + '0'.repeat(56),
                            gasUsed: '30000',
                            value: '0',
                            output: '0x',
                            calls: [],
                        },
                        {
                            from: zeroAddress,
                            to: jaredfromsubwayExampleTx.trace.from,
                            input: '0xa9059cbb' + '0'.repeat(56),
                            gasUsed: '21000',
                            value: '1000000000000000000',
                            output: '0x',
                            calls: [],
                        },
                    ],
                },
            }
            const response = await request(app)
                .post('/detect')
                .send(payload)
                .set('Content-Type', 'application/json')

            const body: DetectionResponse = response.body

            expect(response.status).toBe(HTTP_STATUS_CODES.OK)
            expect(body.detected).toBe(false)
        })

        test('detect validation', async () => {
            const response = await request(app)
                .post('/detect')
                .send({ ...requestPayload, protocolAddress: 'definitely not address' })
                .set('Content-Type', 'application/json')

            expect(response.status).toBe(HTTP_STATUS_CODES.BAD_REQUEST)
        })

        test('detect validation nested', async () => {
            const response = await request(app)
                .post('/detect')
                .send({
                    ...requestPayload,
                    trace: {
                        ...requestPayload.trace,
                        from: 'not valid address',
                        to: 'not valid as well',
                        logs: [
                            {
                                address: 'not address deeply nested',
                                data: '0x...',
                                topics: ['0x...'],
                            },
                        ],
                    },
                })
                .set('Content-Type', 'application/json')

            expect(response.status).toBe(HTTP_STATUS_CODES.BAD_REQUEST)
            expect(response.body.message).toContain('trace.from')
            expect(response.body.message).toContain('trace.to')
            expect(response.body.message).toContain('trace.logs.0.address')
        })
    })
})
