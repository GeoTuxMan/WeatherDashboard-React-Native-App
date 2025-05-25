import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import axios from 'axios';

// Definim tipurile pentru datele meteo
type WeatherData = {
  current_weather: {
    temperature: number;
    weathercode: number;
    windspeed: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    pressure_msl: number[];
    relative_humidity_2m: number[];
    visibility: number[];
  };
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
  };
};

type AirQualityData = {
  hourly: {
    european_aqi: number[];
  };
};

const WeatherApp: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [date, setDate] = useState<string>('');

  // Obiectul cu iconite 
  const icons: Record<number, any> = {
    0: require('./assets/icons/01d.png'),
    1: require('./assets/icons/02d.png'),
    2: require('./assets/icons/03d.png'),
    3: require('./assets/icons/04d.png'),
    45: require('./assets/icons/04d.png'),
    48: require('./assets/icons/04d.png'),
    51: require('./assets/icons/09d.png'),
    61: require('./assets/icons/09d.png'),
    63: require('./assets/icons/10d.png'),
    65: require('./assets/icons/10d.png'),
    71: require('./assets/icons/13d.png'),
    80: require('./assets/icons/10d.png'),
    95: require('./assets/icons/11d.png'),
    99: require('./assets/icons/11d.png')
  };

  const weatherDescriptions: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle',
    61: 'Light rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Snow', 80: 'Showers', 95: 'Thunderstorm', 99: 'Heavy thunderstorm'
  };

  useEffect(() => {
    const today = new Date();
    setDate(today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));

    const fetchData = async () => {
      try {
        const [weatherResponse, airQualityResponse] = await Promise.all([
          axios.get<WeatherData>('https://api.open-meteo.com/v1/forecast?latitude=44.17&longitude=28.62&hourly=temperature_2m,pressure_msl,relative_humidity_2m,visibility&daily=temperature_2m_min,temperature_2m_max,sunrise,sunset,uv_index_max&current_weather=true&timezone=auto'),
          axios.get<AirQualityData>('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=44.17&longitude=28.62&hourly=pm10,pm2_5,european_aqi&timezone=auto')
        ]);

        setWeatherData(weatherResponse.data);
        setAirQuality(airQualityResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const formatTime = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const interpretAQI = (value: number): string => {
    const aqiMap: Record<number, string> = {
      1: "Good",
      2: "Fair",
      3: "Moderate",
      4: "Poor",
      5: "Very Poor"
    };
    return aqiMap[value] || "Unknown";
  };

  if (!weatherData || !airQuality) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // Pregatire date pentru grafic
  // Obține data și ora curentă
const now = new Date();
const currentDate = now.toISOString().split('T')[0]; // Format YYYY-MM-DD
const currentHour = now.getHours();

// Filtrează doar orele din ziua curentă (±2 ore)
const relevantData = weatherData.hourly.time
  .map((time, index) => ({
    fullTime: new Date(time),
    date: time.split('T')[0],
    hour: new Date(time).getHours(),
    temp: weatherData.hourly.temperature_2m[index],
    index
  }))
  .filter(({ date, hour }) => 
    date === currentDate && 
    hour >= currentHour - 2 && 
    hour <= currentHour + 2
  );

// Extrage etichetele și datele pentru grafic
const chartLabels = relevantData.map(({ fullTime }) => 
  fullTime.getHours() + ":00"
);
const chartData = relevantData.map(({ temp }) => temp);

// Calculează lățimea graficului
const chartWidth = Math.max(
  Dimensions.get('window').width - 40,
  relevantData.length * 60
);
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.city}>Constanta, Romania</Text>
      <Text style={styles.date}>{date}</Text>

      <View style={styles.currentWeather}>
        {/* Column 1 */}
        <View style={styles.weatherColumn}>
          <Image 
            source={icons[weatherData.current_weather.weathercode] || icons[0]} 
            style={styles.weatherIcon}
          />
          <Text style={styles.temperature}>
            {Math.round(weatherData.current_weather.temperature)}°C
          </Text>
          <Text style={styles.description}>
            {weatherDescriptions[weatherData.current_weather.weathercode] || 'N/A'}
          </Text>
        </View>

        {/* Column 2 */}
        <View style={styles.detailsColumn}>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/sunrise.png')} style={styles.smallIcon} />
            <Text>Sunrise: {formatTime(weatherData.daily.sunrise[0])}</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/wind.png')} style={styles.smallIcon} />
            <Text>Wind: {weatherData.current_weather.windspeed} km/h</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/pressure.png')} style={styles.smallIcon} />
            <Text>Pressure: {weatherData.hourly.pressure_msl[0]} hPa</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/visibility.png')} style={styles.smallIcon} />
            <Text>Visibility: {(weatherData.hourly.visibility[0]/1000).toFixed(1)} km</Text>
          </View>
        </View>

        {/* Column 3 */}
        <View style={styles.detailsColumn}>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/sunset.png')} style={styles.smallIcon} />
            <Text>Sunset: {formatTime(weatherData.daily.sunset[0])}</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/humidity.png')} style={styles.smallIcon} />
            <Text>Humidity: {weatherData.hourly.relative_humidity_2m[0]}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/uvi.png')} style={styles.smallIcon} />
            <Text>UV Index: {weatherData.daily.uv_index_max[0]}</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={require('./assets/icons/aqi.png')} style={styles.smallIcon} />
            <Text>Air Quality: {interpretAQI(airQuality.hourly.european_aqi[0])}</Text>
          </View>
        </View>
      </View>

      

      {/* 3-Day Forecast */}
      <Text style={styles.forecastTitle}>Forecast for 3 days</Text>
      <View style={styles.forecastContainer}>
        {[1, 2, 3].map(day => (
          <View key={day} style={styles.forecastCard}>
            <Text style={styles.forecastDay}>
              {new Date(weatherData.daily.time[day]).toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Image 
              source={icons[weatherData.current_weather.weathercode] || icons[0]} 
              style={styles.forecastIcon}
            />
            <Text style={styles.forecastTemp}>
              {Math.round(weatherData.daily.temperature_2m_min[day])}° / {Math.round(weatherData.daily.temperature_2m_max[day])}°
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