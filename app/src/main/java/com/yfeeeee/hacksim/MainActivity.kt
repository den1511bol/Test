// HackSim - Developer: @yfeeeee
package com.yfeeeee.hacksim

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class MainActivity : ComponentActivity() {
    private lateinit var game: Game

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        game = Game(getSharedPreferences("hacksim", Context.MODE_PRIVATE))
        setContent { HackApp(game) }
    }
}
