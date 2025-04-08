import { DetectionRequest, DetectionResponse } from './dtos'
import { flattenTraceCalls } from './utils'

/**
 * DetectionService
 *
 * Implements a `detect` method that receives an enriched view of an
 * EVM compatible transaction (i.e. `DetectionRequest`)
 * and returns a `DetectionResponse`
 *
 * API Reference:
 * https://github.com/ironblocks/venn-custom-detection/blob/master/docs/requests-responses.docs.md
 */

const UNISWAP_SWAP_V2_SIGNATURE = '0x022c0d9f'
const UNISWAP_SWAP_V3_SIGNATURE = '0x128acb08'
const UNISWAP_SWAP_V4_SIGNATURE = '0xf3cd914c'
const ONEINCH_SWAP_V5_SIGNATURE = '0x12aa3caf'

// TODO: more signatures can be added for better discovery
export const SWAP_SIGNATURES = [
    UNISWAP_SWAP_V2_SIGNATURE,
    UNISWAP_SWAP_V3_SIGNATURE,
    UNISWAP_SWAP_V4_SIGNATURE,
    ONEINCH_SWAP_V5_SIGNATURE,
]

export class DetectionService {
    /**
     * Update this implementation code to insepct the `DetectionRequest`
     * based on your custom business logic
     */
    public static async detect(request: DetectionRequest): Promise<DetectionResponse> {
        const detected = await this.detectMevRequest(request)

        return new DetectionResponse({
            request,
            detectionInfo: {
                detected,
            },
        })
    }

    private static async detectMevRequest(request: DetectionRequest): Promise<boolean> {
        const { trace } = request

        if (!trace.calls?.length) {
            return false
        }

        const flattenedCalls = flattenTraceCalls(trace.calls)

        const hasSwapCall = flattenedCalls.some(call =>
            SWAP_SIGNATURES.includes(call.input.slice(0, 10)),
        )

        // Arbitrage should always have a swap call
        if (!hasSwapCall) {
            return false
        }

        const returnsFundsBack = flattenedCalls.some(call => trace.from === call.to)

        // after the swaps, MEV contracts usually dont sends funds back to the contract caller
        // which also helps us to separate MEV calls from just a sophisticated defi swap routing
        if (returnsFundsBack) {
            return false
        }

        // If we have an etherscan api key, we can check if the contract is verified
        // MEV bots never verify their contracts. On the contrary, DeFi protocols' contracts are usually verified
        // P.S. Calling etherscan API takes ~700ms, this check can be ommited if considered too slow
        if (process.env.ETHERSCAN_API_KEY) {
            const isVerified = await this.isContractVerified(trace.from)

            if (isVerified) {
                return false
            }
        }

        return true
    }

    private static async isContractVerified(address: string): Promise<boolean> {
        const response = await fetch(
            `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`,
        )
        const data = await response.json()

        return data.result !== 'Contract source code not verified'
    }
}
