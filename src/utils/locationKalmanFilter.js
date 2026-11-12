const MAX_FIX_AGE_MS = 5_000
const MAX_ACCURACY_METERS = 20
const PROCESS_NOISE_METERS_PER_SECOND = 4

function distanceMeters(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const latitude1 = radians(first.latitude)
  const latitude2 = radians(second.latitude)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export class LocationKalmanFilter {
  state = null

  update(position, now = Date.now()) {
    const { latitude, longitude, accuracy } = position.coords
    const ageMs = now - position.timestamp
    if (
      !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || !Number.isFinite(position.timestamp)
      || latitude < -90
      || latitude > 90
      || longitude < -180
      || longitude > 180
      || !Number.isFinite(accuracy)
      || accuracy <= 0
      || accuracy > MAX_ACCURACY_METERS
      || ageMs < -1_000
      || ageMs > MAX_FIX_AGE_MS
    ) {
      return null
    }

    if (!this.state) {
      this.state = {
        latitude,
        longitude,
        variance: accuracy ** 2,
        timestamp: position.timestamp,
      }
      return { latitude, longitude, accuracy }
    }

    const elapsedSeconds = Math.max(0, (position.timestamp - this.state.timestamp) / 1_000)
    if (elapsedSeconds === 0) return null

    const predictedVariance = this.state.variance
      + PROCESS_NOISE_METERS_PER_SECOND * elapsedSeconds
    const measurementVariance = accuracy ** 2
    const innovationMeters = distanceMeters(this.state, { latitude, longitude })
    const outlierThreshold = Math.max(
      35,
      3 * Math.sqrt(predictedVariance + measurementVariance),
    )
    if (innovationMeters > outlierThreshold) return null

    const gain = predictedVariance / (predictedVariance + measurementVariance)
    this.state = {
      latitude: this.state.latitude + (latitude - this.state.latitude) * gain,
      longitude: this.state.longitude + (longitude - this.state.longitude) * gain,
      variance: (1 - gain) * predictedVariance,
      timestamp: position.timestamp,
    }
    return {
      latitude: this.state.latitude,
      longitude: this.state.longitude,
      accuracy,
    }
  }

  reset() {
    this.state = null
  }
}
