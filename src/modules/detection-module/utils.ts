import { DetectionRequestTraceCall } from './dtos'

export const flattenTraceCalls = (calls: DetectionRequestTraceCall[]) => {
    const flattened: DetectionRequestTraceCall[] = []

    function recurse(call: DetectionRequestTraceCall) {
        // Add the current call (excluding its nested calls) to the flattened array
        const callCopy = { ...call }
        delete callCopy.calls // Remove nested calls from this copy
        flattened.push(callCopy)

        // If there are nested calls, process them recursively
        if (call.calls && Array.isArray(call.calls)) {
            call.calls.forEach(nestedCall => recurse(nestedCall))
        }
    }

    // Process each top-level call
    calls.forEach(call => recurse(call))

    return flattened
}
