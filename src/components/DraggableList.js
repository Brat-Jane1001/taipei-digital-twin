/**
 * DraggableList - 拖曳排序清單（不依賴 reanimated / 額外套件）
 *
 * - 每列固定高度，位置用 translateY 表示，移動全程走原生動畫（useNativeDriver）
 * - 手指按住「把手」（renderRow 提供的 panHandlers）上下拖，其他列自動讓位
 * - 放開時呼叫 onReorder(newData)；拖曳期間會呼叫 onDragStateChange(true/false)，
 *   讓外層 ScrollView 暫停捲動，避免搶手勢
 *
 * data 每一項都要有穩定且唯一的 id。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, View } from 'react-native';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function Row({ item, index, rowHeight, y, active, renderRow, handlersRef }) {
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => handlersRef.current.start(item.id),
      onPanResponderMove: (_, g) => handlersRef.current.move(item.id, g.dy),
      onPanResponderRelease: () => handlersRef.current.end(item.id),
      onPanResponderTerminate: () => handlersRef.current.end(item.id),
    })
  ).current;

  return (
    <Animated.View
      style={{
        position: 'absolute', left: 0, right: 0, height: rowHeight,
        transform: [{ translateY: y }, { scale: active ? 1.02 : 1 }],
        zIndex: active ? 10 : 0,
        elevation: active ? 6 : 0,
        opacity: active ? 0.96 : 1,
      }}
    >
      {renderRow(item, index, pan.panHandlers, active)}
    </Animated.View>
  );
}

export default function DraggableList({ data, rowHeight = 76, renderRow, onReorder, onDragStateChange }) {
  const n = data.length;
  const ys = useRef(new Map());
  const drag = useRef(null);                 // { id, from, to }
  const dataRef = useRef(data);
  const handlersRef = useRef({});
  const [activeId, setActiveId] = useState(null);
  dataRef.current = data;

  const yOf = (id, index) => {
    let v = ys.current.get(id);
    if (!v) { v = new Animated.Value(index * rowHeight); ys.current.set(id, v); }
    return v;
  };

  // 資料變動（新增、刪除、排序完成）時，把每一列放回自己的位置
  useEffect(() => {
    if (drag.current) return;
    data.forEach((d, i) => yOf(d.id, i).setValue(i * rowHeight));
    for (const key of [...ys.current.keys()]) {
      if (!data.some(d => d.id === key)) ys.current.delete(key);
    }
  }, [data, rowHeight]);          // eslint-disable-line react-hooks/exhaustive-deps

  handlersRef.current = {
    start(id) {
      const from = dataRef.current.findIndex(d => d.id === id);
      if (from < 0) return;
      drag.current = { id, from, to: from };
      setActiveId(id);
      onDragStateChange?.(true);
    },

    move(id, dy) {
      const st = drag.current;
      if (!st || st.id !== id) return;
      const list = dataRef.current;
      const y = clamp(st.from * rowHeight + dy, 0, (list.length - 1) * rowHeight);
      yOf(id, st.from).setValue(y);

      const to = clamp(Math.round(y / rowHeight), 0, list.length - 1);
      if (to === st.to) return;
      st.to = to;
      list.forEach((d, i) => {
        if (d.id === id) return;
        let target = i;
        if (st.from < to && i > st.from && i <= to) target = i - 1;
        else if (st.from > to && i < st.from && i >= to) target = i + 1;
        Animated.timing(yOf(d.id, i), { toValue: target * rowHeight, duration: 140, useNativeDriver: true }).start();
      });
    },

    end(id) {
      const st = drag.current;
      if (!st || st.id !== id) return;
      const list = dataRef.current;
      const { from, to } = st;
      Animated.timing(yOf(id, from), { toValue: to * rowHeight, duration: 120, useNativeDriver: true }).start();

      drag.current = null;
      setActiveId(null);
      onDragStateChange?.(false);

      if (from !== to) {
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onReorder?.(next);
      }
    },
  };

  return (
    <View style={{ height: n * rowHeight }}>
      {data.map((item, index) => (
        <Row
          key={item.id}
          item={item}
          index={index}
          rowHeight={rowHeight}
          y={yOf(item.id, index)}
          active={activeId === item.id}
          renderRow={renderRow}
          handlersRef={handlersRef}
        />
      ))}
    </View>
  );
}
