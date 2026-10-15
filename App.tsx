import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, Dimensions, RefreshControl, TouchableOpacity,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import axios from 'axios';

const LAT = 44.17;
const LON = 28.62;

// Open-Meteo: valorile curente vin din "current" (ora locala a orasului, timezone=auto)
const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  '&current=temperature_2m,relative_humidity_2m,pressure_msl,visibility,weather_code,wind_speed_10m' +
  '&hourly=temperature_2m' +
  '&daily=weather_code,temperature_2m_min,temperature_2m_max,sunrise,sunset,uv_index_max' +
  '&timezone=auto&forecast_days=4';
const AIR_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}` +
  '&current=european_aqi&timezone=auto';

// Definim tipurile pentru datele meteo
type WeatherData = {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    pressure_msl: number;
    visibility: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
  };
};

type AirQualityData = {
  current: {
    european_aqi: number | null;
  };
};

// Iconite si descrieri pentru toate codurile WMO folosite de Open-Meteo
const ICONS = {
  clear: require('./assets/icons/01d.png'),
  fewClouds: require('./assets/icons/02d.png'),
  clouds: require('./assets/icons/03d.png'),
  overcast: require('./assets/icons/04d.png'),
  fog: require('./assets/icons/50d.png'),
  drizzle: require('./assets/icons/09d.png'),
  rain: require('./assets/icons/10d.png'),
  snow: require('./assets/icons/13d.png'),
  storm: require('./assets/icons/11d.png'),
};

const WMO: Record<number, [string, keyof typeof ICONS]> = {
  0: ['Clear sky', 'clear'],
  1: ['Mainly clear', 'fewClouds'],
  2: ['Partly cloudy', 'clouds'],
  3: ['Overcast', 'overcast'],
  45: ['Fog', 'fog'],
  48: ['Depositing rime fog', 'fog'],
  51: ['Light drizzle', 'drizzle'],
  53: ['Drizzle', 'drizzle'],
  55: ['Dense drizzle', 'drizzle'],
  56: ['Freezing drizzle', 'drizzle'],
  57: ['Dense freezing drizzle', 'drizzle'],
  61: ['Light rain', 'rain'],
  63: ['Moderate rain', 'rain'],
  65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'],
  67: ['Heavy freezing rain', 'rain'],
  71: ['Light snow', 'snow'],
  73: ['Snow', 'snow'],
  75: ['Heavy snow', 'snow'],
  77: ['Snow grains', 'snow'],
  80: ['Light showers', 'drizzle'],
  81: ['Showers', 'drizzle'],
  82: ['Violent showers', 'rain'],
  85: ['Snow showers', 'snow'],
  86: ['Heavy snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'],
  96: ['Thunderstorm with hail', 'storm'],
  99: ['Thunderstorm with heavy hail', 'storm'],
};

const weatherIcon = (code: number) => ICONS[WMO[code]?.[1] ?? 'clear'];
const weatherText = (code: number) => WMO[code]?.[0] ?? 'Unknown';

// European AQI (0-100+), benzile Agentiei Europene de Mediu
const interpretAQI = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  if (value <= 20) return 'Good';
  if (value <= 40) return 'Fair';
  if (value <= 60) return 'Moderate';
  if (value <= 80) return 'Poor';
  if (value <= 100) return 'Very poor';
  return 'Extremely poor';
};

// Orele din API sunt deja in ora locala a orasului ("2026-10-15T07:20"): le afisam direct
const formatTime = (iso: string): string => iso.slice(11, 16);

const WeatherApp: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [weatherResponse, airQualityResponse] = await Promise.all([
        axios.get<WeatherData>(WEATHER_URL, { timeout: 15000 }),
        axios.get<AirQualityData>(AIR_URL, { timeout: 15000 }),
      ]);
      setWeatherData(weatherResponse.data);
      setAirQuality(airQualityResponse.data);
    } catch (e) {
      console.error('Error fetching data:', e);
      setError('Could not load the weather data. Check the internet connection.');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (!weatherData || !airQuality) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        {error ? (
          <>
            <Text style={{ textAlign: 'center', marginBottom: 12 }}>{error}</Text>
            <TouchableOpacity onPress={fetchData}>
              <Text style={{ color: '#1e88e5', fontWeight: 'bold' }}>Try again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text>Loading...</Text>
        )}
      </View>
    );
  }

  const { current, daily, hourly } = weatherData;

  // Data afisata = data locala a orasului (din API), nu cea a telefonului
  const date = new Date(`${current.time.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Grafic: ora curenta +/- 2 ore, cautata dupa textul orei (fara conversii de fus orar)
  const nowHour = `${current.time.slice(0, 13)}:00`;
  const nowIndex = Math.max(0, hourly.time.indexOf(nowHour));
  const start = Math.max(0, nowIndex - 2);
  const end = Math.min(hourly.time.length, nowIndex + 3);
  const chartLabels = hourly.time.slice(start, end).map((t) => t.slice(11, 16));
  const chartData = hourly.temperature_2m.slice(start, end);
  const chartWidth = Dimensions.get('window').width - 40;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.city}>Constanta, Romania</Text>
      <Text style={styles.date}>{date}</Text>

      <View style={styles.currentWeather}>
        {/* Column 1 */}
        <View style={styles.weatherColumn}>
          <Image source={weatherIcon(current.weather_code)} style={styles.weatherIcon} />
          <Text style={styles.temperature}>{Math.round(current.temperature_2m)}°C</Text>
          <Text style={styles.description}>{weatherText(current.weather_code)}</Text>
        </View>

        {/* Column 2 */}
        <View style={styles.detailsColumn}>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/sunrise.png')} style={styles.smallIcon} />
            <Text>Sunrise: {formatTime(daily.sunrise[0])}</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/wind.png')} style={styles.smallIcon} />
            <Text>Wind: {Math.round(current.wind_speed_10m)} km/h</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/pressure.png')} style={styles.smallIcon} />
            <Text>Pressure: {Math.round(current.pressure_msl)} hPa</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/visibility.png')} style={styles.smallIcon} />
            <Text>Visibility: {(current.visibility / 1000).toFixed(1)} km</Text>
          </View>
        </View>

        {/* Column 3 */}
        <View style={styles.detailsColumn}>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/sunset.png')} style={styles.smallIcon} />
            <Text>Sunset: {formatTime(daily.sunset[0])}</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/humidity.png')} style={styles.smallIcon} />
            <Text>Humidity: {current.relative_humidity_2m}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/uvi.png')} style={styles.smallIcon} />
            <Text>UV Index: {daily.uv_index_max[0]?.toFixed(1)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/aqi.png')} style={styles.smallIcon} />
            <Text>Air Quality: {interpretAQI(airQuality.current.european_aqi)}</Text>
          </View>
        </View>
      </View>

      {/* Temperature around the current hour */}
      {chartData.length > 1 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Temperature (°C) around now</Text>
          <LineChart
            data={{ labels: chartLabels, datasets: [{ data: chartData }] }}
            width={chartWidth - 30}
            height={180}
            yAxisSuffix="°"
            chartConfig={{
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(30, 136, 229, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(108, 117, 125, ${opacity})`,
              propsForDots: { r: '4' },
            }}
            bezier
            style={{ borderRadius: 12 }}
          />
        </View>
      )}

      {/* 3-Day Forecast */}
      <Text style={styles.forecastTitle}>Forecast for 3 days</Text>
      <View style={styles.forecastContainer}>
        {[1, 2, 3].filter((day) => day < daily.time.length).map((day) => (
          <View key={daily.time[day]} style={styles.forecastCard}>
            <Text style={styles.forecastDay}>
              {new Date(`${daily.time[day]}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Image source={weatherIcon(daily.weather_code[day])} style={styles.forecastIcon} />
            <Text style={styles.forecastTemp}>
              {Math.round(daily.temperature_2m_min[day])}° / {Math.round(daily.temperature_2m_max[day])}°
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// Stilurile rămân identice
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f6fc',
    padding: 20
  },
  city: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5
  },
  date: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6c757d',
    marginBottom: 20
  },
  currentWeather: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  weatherColumn: {
    alignItems: 'center',
    flex: 1
  },
  detailsColumn: {
    flex: 1,
    paddingLeft: 10
  },
  weatherIcon: {
    width: 60,
    height: 60,
    marginBottom: 10
  },
  temperature: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5
  },
  description: {
    fontSize: 14,
    color: '#6c757d',
    textTransform: 'capitalize'
  },
  smallIcon: {
    width: 20,
    height: 20,
    marginRight: 8
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10
  },
  forecastTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10
  },
  forecastContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20
  },
  forecastCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    width: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2
  },
  forecastDay: {
    fontWeight: 'bold',
    marginBottom: 5
  },
  forecastIcon: {
    width: 50,
    height: 50,
    marginVertical: 5
  },
  forecastTemp: {
    fontSize: 14
  }
});

export default WeatherApp;