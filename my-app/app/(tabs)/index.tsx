import { Text, View, StyleSheet, ActivityIndicator,TextInput } from 'react-native';
import { Image } from "expo-image"; //方便載入資料用

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>標頭 </Text>
      <Text style={styles.subtitle}>內文內文！</Text>
      <Image source={{ uri: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=400" }} 
  style={{ width: 200, height: 200 }} //放照片的酷地方
/>
    <TextInput placeholder="寫下你的名字"/>
    <ActivityIndicator size={"large"} />
    </View>
  );
}

// 這裡是用來設定樣式 (排版、顏色、大小) 的地方
const styles = StyleSheet.create({
  container: {
    flex: 1, // 填滿整個螢幕
    backgroundColor: 'hsl(0, 0%, 87%)', // 背景顏色
    justifyContent: 'center', // 垂直置中
    alignItems: 'center', // 水平置中
  },
  title: {
    fontSize: 32, // 字體大小
    fontWeight: 'bold', // 粗體
    color: '#333', // 字體顏色
    marginBottom: 10, // 距離下方的空白
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
});