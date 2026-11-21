import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function SwipeCards({ events = [], onSwipe, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 💡 【修正點 1】新增 Ref 來同步最新索引，打破 PanResponder 的閉包鎖死陷阱
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const position = useRef(new Animated.ValueXY()).current;

  // 💡 【修正點 2】將動畫與邏輯抽離成獨立函數，讓滑動與點擊按鈕都能共用
  const forceSwipe = (direction) => {
    const toX = direction === 'right' ? width + 100 : -width - 100;
    Animated.timing(position, {
      toValue: { x: toX, y: 0 },
      duration: 250,
      useNativeDriver: false
    }).start(() => {
      // 確保使用最新的 index 取出正確的景點
      if (onSwipe) onSwipe(events[currentIndexRef.current], direction);
      setCurrentIndex(prev => prev + 1);
      position.setValue({ x: 0, y: 0 });
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 120) {
          forceSwipe('right');
        } else if (gestureState.dx < -120) {
          forceSwipe('left');
        } else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start();
        }
      }
    })
  ).current;

  if (currentIndex >= events.length) {
    return (
      <View style={styles.overlay}>
        <BlurView intensity={80} tint="dark" style={styles.emptyCard}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#32D74B" style={{marginBottom: 16}} />
          <Text style={styles.emptyText}>景點已經全部探索完畢！</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>返回地圖</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    );
  }

  const currentEvent = events[currentIndex];
  
  const rotate = position.x.interpolate({ 
    inputRange: [-width / 2, 0, width / 2], 
    outputRange: ['-10deg', '0deg', '10deg'], 
    extrapolate: 'clamp' 
  });

  // 💡 【新增】根據拖曳方向與距離，動態改變底下按鈕的透明度
  const passOpacity = position.x.interpolate({ 
    inputRange: [-100, 0, 100], 
    outputRange: [1, 0.35, 0.35], 
    extrapolate: 'clamp' 
  });
  const addOpacity = position.x.interpolate({ 
    inputRange: [-100, 0, 100], 
    outputRange: [0.35, 0.35, 1], 
    extrapolate: 'clamp' 
  });

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.absoluteClose} onPress={onClose} activeOpacity={0.7}>
        <BlurView intensity={60} tint="dark" style={styles.closeBlur}>
          <Ionicons name="close" size={24} color="white" />
        </BlurView>
      </TouchableOpacity>
      
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          { transform: [...position.getTranslateTransform(), { rotate }] }
        ]}
      >
        <BlurView intensity={90} tint="dark" style={styles.cardBlur}>
          <View style={styles.cardHeader}>
            <Text style={styles.eventTitle}>{currentEvent?.title || '未知景點'}</Text>
          </View>
          
          <View style={styles.cardBody}>
             <View style={styles.placeholderImg}>
               <Ionicons name="image-outline" size={48} color="#48484A" />
             </View>
             <Text style={styles.eventDesc}>
               {currentEvent?.description || '這是一個值得探索的有趣地方。'}
             </Text>
          </View>

          <View style={styles.hints}>
            <TouchableOpacity onPress={() => forceSwipe('left')} activeOpacity={0.7}>
              <Animated.View style={[styles.hintBox, { opacity: passOpacity }]}>
                <Ionicons name="close-circle" size={28} color="#FF453A" />
                <Text style={{color: '#FF453A', fontWeight: 'bold', fontSize: 16}}>👈 略過</Text>
              </Animated.View>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => forceSwipe('right')} activeOpacity={0.7}>
              <Animated.View style={[styles.hintBox, { opacity: addOpacity }]}>
                <Text style={{color: '#32D74B', fontWeight: 'bold', fontSize: 16}}>加入 👉</Text>
                <Ionicons name="heart-circle" size={28} color="#32D74B" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.65)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 1000 
  },
  absoluteClose: { 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 60 : 40, 
    right: 24, 
    zIndex: 1001,
    borderRadius: 20,
    overflow: 'hidden'
  },
  closeBlur: {
    padding: 8,
  },
  card: { 
    width: width * 0.85, 
    height: height * 0.65, 
    borderRadius: 32, 
    overflow: 'hidden', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 20, 
    elevation: 15 
  },
  cardBlur: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'space-between', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  cardHeader: { 
    marginBottom: 16 
  },
  eventTitle: { 
    color: 'white', 
    fontSize: 28, 
    fontWeight: '800' 
  },
  cardBody: { 
    flex: 1, 
    justifyContent: 'center' 
  },
  placeholderImg: { 
    width: '100%', 
    height: 180, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 24 
  },
  eventDesc: { 
    color: '#EBEBF5', 
    fontSize: 16, 
    lineHeight: 26 
  },
  hints: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingTop: 20, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.1)' 
  },
  hintBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20
  },
  emptyCard: { 
    width: width * 0.8, 
    padding: 40, 
    borderRadius: 32, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  emptyText: { 
    color: 'white', 
    fontSize: 18, 
    fontWeight: '600', 
    marginBottom: 24, 
    textAlign: 'center' 
  },
  closeBtn: { 
    backgroundColor: '#0A84FF', 
    paddingHorizontal: 24, 
    paddingVertical: 16, 
    borderRadius: 16, 
    width: '100%', 
    alignItems: 'center' 
  },
  closeBtnText: { 
    color: 'white', 
    fontSize: 17, 
    fontWeight: 'bold' 
  }
});