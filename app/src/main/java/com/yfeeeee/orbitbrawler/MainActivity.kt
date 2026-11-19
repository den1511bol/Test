// Orbit Brawler - Developer: @yfeeeee
package com.yfeeeee.orbitbrawler

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val save = Save(getSharedPreferences("orbitbrawler", Context.MODE_PRIVATE))
        setContent { BrawlerApp(save) }
    }
}
