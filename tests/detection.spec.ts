import request from 'supertest'

import { app, server } from '@/app'
import * as etherscanHelper from '@/helpers/etherscan.helper'
import { DetectionRequest, DetectionResponse } from '@/modules/detection-module/dtos'
import { SWAP_SIGNATURES } from '@/modules/detection-module/service'
import { HTTP_STATUS_CODES } from '@/types'

import { jaredfromsubwayExampleTx } from './mev-txs/jaredfromsubway1'

const zeroAddress = '0x0000000000000000000000000000000000000000'

const requestPayload = jaredfromsubwayExampleTx

// Mock the etherscan helper function
const isContractVerifiedMock = jest.spyOn(etherscanHelper, 'isContractVerified')

describe('Service Tests', () => {
    const originalEnv = process.env

    beforeEach(() => {
        // Reset mocks and environment before each test
        jest.resetModules() // Clears the cache
        process.env = { ...originalEnv } // Restore original environment variables
        isContractVerifiedMock.mockClear() // Clear mock call history

        // Default mock behavior: Contract is unverified
        isContractVerifiedMock.mockResolvedValue(false)
        // Assume API key is present by default for tests that need it
        process.env.ETHERSCAN_API_KEY = 'mock-api-key'
    })

    afterAll(async () => {
        process.env = originalEnv // Restore original environment after all tests
        server.close()
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

    test('detect success: potential MEV (unverified contract, api key present)', async () => {
        // Mock should return false (unverified) - this is the default set in beforeEach
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

    test('detect success: potential MEV (etherscan api key not present)', async () => {
        // Unset the API key
        delete process.env.ETHERSCAN_API_KEY

        const response = await request(app)
            .post('/detect')
            .send(requestPayload)
            .set('Content-Type', 'application/json')

        const body: DetectionResponse = response.body

        // Should still detect as MEV because the etherscan check is skipped
        expect(response.status).toBe(HTTP_STATUS_CODES.OK)
        expect(body.detected).toBe(true)
        // Ensure the mock was not called because the API key was missing
        expect(isContractVerifiedMock).not.toHaveBeenCalled()
    })

    test('detect fail: verified contract (api key present)', async () => {
        // Mock isContractVerified to return true (verified)
        isContractVerifiedMock.mockResolvedValue(true)

        const response = await request(app)
            .post('/detect')
            .send(requestPayload)
            .set('Content-Type', 'application/json')

        const body: DetectionResponse = response.body

        // Should not detect as MEV because the contract is verified
        expect(response.status).toBe(HTTP_STATUS_CODES.OK)
        expect(body.detected).toBe(false)
        // Ensure the mock was called
        expect(isContractVerifiedMock).toHaveBeenCalledWith(requestPayload.trace.from)
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

    test('detect mev: funds returned to caller', async () => {
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
})
